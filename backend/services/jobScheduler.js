import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { SNMPService } from './snmpService.js';
import { VendorService } from './vendorService.js';

export class JobScheduler {
  constructor(database, notificationService) {
    this.database = database;
    this.notificationService = notificationService;
    this.snmpService = new SNMPService();
    this.vendorService = new VendorService();
    this.scheduledJobs = new Map();
    this.runningJobs = new Set();
  }

  async initialize() {
    try {
      // Load and schedule all active jobs
      const jobs = await this.database.all(
        'SELECT * FROM jobs WHERE is_active = 1 AND schedule_type != "manual"'
      );

      for (const job of jobs) {
        await this.scheduleJob(job);
      }

      console.log(`✅ Scheduled ${jobs.length} jobs`);
    } catch (error) {
      console.error('❌ Failed to initialize job scheduler:', error);
      throw error;
    }
  }

  async scheduleJob(job) {
    try {
      // Remove existing schedule if exists
      if (this.scheduledJobs.has(job.id)) {
        this.scheduledJobs.get(job.id).destroy();
        this.scheduledJobs.delete(job.id);
      }

      if (job.schedule_type === 'manual') {
        return;
      }

      // Validate schedule interval
      if (!job.schedule_interval || job.schedule_interval < 1) {
        console.error(`❌ Invalid schedule interval for job ${job.id}: ${job.schedule_interval}`);
        return;
      }

      // Convert interval to cron expression
      const cronExpression = this.intervalToCron(job.schedule_interval);
      
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        console.error(`❌ Invalid cron expression for job ${job.id}: ${cronExpression}`);
        return;
      }

      const scheduledJob = cron.schedule(cronExpression, async () => {
        await this.executeJob(job.id);
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.scheduledJobs.set(job.id, scheduledJob);
      console.log(`📅 Scheduled job ${job.name} (${job.id}) with interval ${job.schedule_interval} minutes (cron: ${cronExpression})`);
    } catch (error) {
      console.error(`❌ Failed to schedule job ${job.id}:`, error);
    }
  }

  intervalToCron(intervalMinutes) {
    // Ensure minimum interval of 1 minute
    const minutes = Math.max(1, parseInt(intervalMinutes));
    
    if (minutes < 60) {
      // Every X minutes
      return `*/${minutes} * * * *`;
    } else if (minutes < 1440) {
      // Every X hours
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    } else {
      // Every X days
      const days = Math.floor(minutes / 1440);
      return `0 0 */${days} * *`;
    }
  }

  async executeJob(jobId) {
    if (this.runningJobs.has(jobId)) {
      console.log(`⚠️ Job ${jobId} is already running, skipping execution`);
      return;
    }

    const startTime = Date.now();
    this.runningJobs.add(jobId);

    // Broadcast job start status
    await this.notificationService.broadcastJobStatus(jobId, 'running', {
      message: 'Job execution started',
      startTime: new Date().toISOString()
    });

    try {
      // Get job details
      const job = await this.database.get('SELECT * FROM jobs WHERE id = ?', [jobId]);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      console.log(`🚀 Starting job execution: ${job.name}`);

      // Get job switches
      const switches = await this.database.all(
        'SELECT * FROM switches WHERE job_id = ?',
        [jobId]
      );

      if (switches.length === 0) {
        throw new Error('No switches configured for this job');
      }

      let totalDevicesFound = 0;
      let newDevices = 0;
      let unauthorizedDevices = 0;
      const errors = [];

      // Broadcast progress updates
      await this.notificationService.broadcastJobStatus(jobId, 'scanning', {
        message: `Scanning ${switches.length} switches...`,
        switchCount: switches.length,
        currentSwitch: 0
      });

      // Scan each switch via SNMP
      for (let i = 0; i < switches.length; i++) {
        const switchConfig = switches[i];
        
        try {
          console.log(`🔍 Scanning switch: ${switchConfig.name} (${switchConfig.host})`);
          
          // Broadcast current switch being scanned
          await this.notificationService.broadcastJobStatus(jobId, 'scanning', {
            message: `Scanning switch: ${switchConfig.name}`,
            switchCount: switches.length,
            currentSwitch: i + 1,
            switchName: switchConfig.name
          });
          
          const scanResult = await this.snmpService.scanMacAddresses(
            {
              host: switchConfig.host,
              community: switchConfig.community,
              version: switchConfig.version || '2c'
            },
            job.vlan_id
          );

          totalDevicesFound += scanResult.macAddresses.length;

          // Process each MAC address with interface information and vendor lookup
          for (const macAddress of scanResult.macAddresses) {
            const interfaceInfo = scanResult.macDetails[macAddress];
            await this.processDevice(job, switchConfig, macAddress, interfaceInfo);
          }

          // Update device statuses
          await this.updateDeviceStatuses(jobId, switchConfig.id, scanResult.macAddresses);

        } catch (error) {
          console.error(`❌ Failed to scan switch ${switchConfig.name}:`, error);
          errors.push(`Switch ${switchConfig.name}: ${error.message}`);
        }
      }

      // Count new and unauthorized devices
      const counts = await this.getDeviceCounts(jobId, startTime);
      newDevices = counts.new;
      unauthorizedDevices = counts.unauthorized;

      // Clean up old devices based on retention policy
      await this.cleanupOldDevices(job);

      // Record job execution
      await this.recordJobExecution(
        jobId,
        'success',
        totalDevicesFound,
        newDevices,
        unauthorizedDevices,
        errors.length > 0 ? errors.join('; ') : null,
        Date.now() - startTime
      );

      // Send notifications
      await this.sendJobNotifications(job, newDevices, unauthorizedDevices);

      // Broadcast job completion
      await this.notificationService.broadcastJobStatus(jobId, 'completed', {
        message: 'Job completed successfully',
        devicesFound: totalDevicesFound,
        newDevices,
        unauthorizedDevices,
        duration: Date.now() - startTime
      });

      console.log(`✅ Job ${job.name} completed successfully`);

    } catch (error) {
      console.error(`❌ Job ${jobId} failed:`, error);
      
      await this.recordJobExecution(
        jobId,
        'failed',
        0,
        0,
        0,
        error.message,
        Date.now() - startTime
      );

      // Broadcast job failure
      await this.notificationService.broadcastJobStatus(jobId, 'failed', {
        message: `Job failed: ${error.message}`,
        error: error.message
      });

      // Send error notification
      await this.notificationService.createNotification({
        jobId,
        type: 'error',
        title: 'Job Execution Failed',
        message: `Job execution failed: ${error.message}`,
        severity: 'error'
      });

    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  async processDevice(job, switchConfig, macAddress, interfaceInfo) {
    try {
      // Check if device exists
      const existingDevice = await this.database.get(
        'SELECT * FROM known_devices WHERE job_id = ? AND mac_address = ? AND switch_id = ?',
        [job.id, macAddress, switchConfig.id]
      );

      // Get vendor information
      let vendor = null;
      try {
        vendor = await this.vendorService.getVendor(macAddress);
      } catch (error) {
        console.error(`Failed to get vendor for ${macAddress}:`, error);
      }

      if (existingDevice) {
        // Update last seen, status, interface information, and vendor
        await this.database.run(
          `UPDATE known_devices SET 
           last_seen = CURRENT_TIMESTAMP, 
           status = "online",
           interface_name = ?,
           bridge_port = ?,
           if_index = ?,
           vendor = ?
           WHERE id = ?`,
          [
            interfaceInfo?.interface || null,
            interfaceInfo?.bridgePort || null,
            interfaceInfo?.ifIndex || null,
            vendor,
            existingDevice.id
          ]
        );
      } else {
        // Check if device is in whitelist
        const whitelistEntry = await this.database.get(
          'SELECT * FROM whitelist WHERE job_id = ? AND mac_address = ?',
          [job.id, macAddress]
        );

        const isAuthorized = !!whitelistEntry;

        // Create new device with interface information and vendor
        const deviceId = uuidv4();
        await this.database.run(
          `INSERT INTO known_devices 
           (id, job_id, mac_address, switch_id, vlan_id, interface_name, bridge_port, if_index, vendor, is_authorized, status, device_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceId,
            job.id,
            macAddress,
            switchConfig.id,
            job.vlan_id,
            interfaceInfo?.interface || null,
            interfaceInfo?.bridgePort || null,
            interfaceInfo?.ifIndex || null,
            vendor,
            isAuthorized,
            'online',
            whitelistEntry?.device_name || null
          ]
        );

        console.log(`📱 New device discovered: ${macAddress} (${vendor || 'Unknown vendor'}) on ${interfaceInfo?.interface || 'unknown interface'} (${isAuthorized ? 'authorized' : 'unauthorized'})`);
      }
    } catch (error) {
      console.error(`Failed to process device ${macAddress}:`, error);
    }
  }

  async updateDeviceStatuses(jobId, switchId, currentMacAddresses) {
    try {
      // Set all devices for this switch to offline
      await this.database.run(
        'UPDATE known_devices SET status = "offline" WHERE job_id = ? AND switch_id = ?',
        [jobId, switchId]
      );

      // Set current devices to online
      if (currentMacAddresses.length > 0) {
        const placeholders = currentMacAddresses.map(() => '?').join(',');
        await this.database.run(
          `UPDATE known_devices SET status = "online", last_seen = CURRENT_TIMESTAMP 
           WHERE job_id = ? AND switch_id = ? AND mac_address IN (${placeholders})`,
          [jobId, switchId, ...currentMacAddresses]
        );
      }
    } catch (error) {
      console.error('Failed to update device statuses:', error);
    }
  }

  async getDeviceCounts(jobId, startTime) {
    try {
      const startTimeISO = new Date(startTime).toISOString();
      
      const newDevicesResult = await this.database.get(
        'SELECT COUNT(*) as count FROM known_devices WHERE job_id = ? AND first_seen >= ?',
        [jobId, startTimeISO]
      );

      const unauthorizedDevicesResult = await this.database.get(
        'SELECT COUNT(*) as count FROM known_devices WHERE job_id = ? AND is_authorized = 0 AND status = "online"',
        [jobId]
      );

      return {
        new: newDevicesResult?.count || 0,
        unauthorized: unauthorizedDevicesResult?.count || 0
      };
    } catch (error) {
      console.error('Failed to get device counts:', error);
      return { new: 0, unauthorized: 0 };
    }
  }

  async cleanupOldDevices(job) {
    try {
      if (job.retention_policy === 'keep_forever') {
        return;
      }

      let cutoffDate;
      if (job.retention_policy === 'remove_immediately') {
        cutoffDate = new Date().toISOString();
      } else if (job.retention_policy === '7days') {
        cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      if (cutoffDate) {
        const result = await this.database.run(
          'DELETE FROM known_devices WHERE job_id = ? AND last_seen < ? AND status = "offline"',
          [job.id, cutoffDate]
        );

        if (result.changes > 0) {
          console.log(`🧹 Cleaned up ${result.changes} old devices for job ${job.name}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old devices:', error);
    }
  }

  async recordJobExecution(jobId, status, devicesFound, newDevices, unauthorizedDevices, errorMessage, duration) {
    try {
      const historyId = uuidv4();
      await this.database.run(
        `INSERT INTO job_history 
         (id, job_id, status, devices_found, new_devices, unauthorized_devices, error_message, duration)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [historyId, jobId, status, devicesFound, newDevices, unauthorizedDevices, errorMessage, duration]
      );
    } catch (error) {
      console.error('Failed to record job execution:', error);
    }
  }

  async sendJobNotifications(job, newDevices, unauthorizedDevices) {
    try {
      if (!job.notifications_enabled) {
        return;
      }

      // Notify about new devices
      if (newDevices > 0) {
        await this.notificationService.createNotification({
          jobId: job.id,
          type: 'info',
          title: 'New Devices Discovered',
          message: `${newDevices} new device(s) discovered in job "${job.name}"`,
          severity: 'info'
        });
      }

      // Notify about unauthorized devices
      if (unauthorizedDevices > 0 && job.warning_notifications) {
        await this.notificationService.createNotification({
          jobId: job.id,
          type: 'warning',
          title: 'Unauthorized Devices Detected',
          message: `${unauthorizedDevices} unauthorized device(s) detected in job "${job.name}"`,
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error('Failed to send job notifications:', error);
    }
  }

  async unscheduleJob(jobId) {
    try {
      if (this.scheduledJobs.has(jobId)) {
        const scheduledJob = this.scheduledJobs.get(jobId);
        if (scheduledJob && typeof scheduledJob.destroy === 'function') {
          scheduledJob.destroy();
        }
        this.scheduledJobs.delete(jobId);
        console.log(`📅 Unscheduled job ${jobId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to unschedule job ${jobId}:`, error);
      // Don't throw error, just log it
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down job scheduler...');
    
    // Wait for running jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeout) {
      console.log(`⏳ Waiting for ${this.runningJobs.size} running job(s) to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Destroy all scheduled jobs
    for (const [jobId, scheduledJob] of this.scheduledJobs) {
      try {
        if (scheduledJob && typeof scheduledJob.destroy === 'function') {
          scheduledJob.destroy();
        }
      } catch (error) {
        console.error(`Error destroying scheduled job ${jobId}:`, error);
      }
    }
    
    this.scheduledJobs.clear();
    
    // Close SNMP sessions
    this.snmpService.closeAllSessions();
    
    console.log('✅ Job scheduler shutdown complete');
  }
}