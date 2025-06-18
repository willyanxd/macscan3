import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { SSHService } from './sshService.js';

export class JobScheduler {
  constructor(database, notificationService) {
    this.database = database;
    this.notificationService = notificationService;
    this.sshService = new SSHService();
    this.scheduledJobs = new Map();
    this.runningJobs = new Map(); // Changed to Map to store job status
    this.jobStatusEmitter = notificationService; // Use notification service for real-time updates
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

      // Convert interval to cron expression
      const cronExpression = this.intervalToCron(job.schedule_interval);
      
      const scheduledJob = cron.schedule(cronExpression, async () => {
        await this.executeJob(job.id);
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.scheduledJobs.set(job.id, scheduledJob);
      console.log(`📅 Scheduled job ${job.name} with interval ${job.schedule_interval} minutes`);
    } catch (error) {
      console.error(`❌ Failed to schedule job ${job.id}:`, error);
    }
  }

  intervalToCron(intervalMinutes) {
    if (intervalMinutes < 60) {
      return `*/${intervalMinutes} * * * *`;
    } else if (intervalMinutes < 1440) {
      const hours = Math.floor(intervalMinutes / 60);
      return `0 */${hours} * * *`;
    } else {
      const days = Math.floor(intervalMinutes / 1440);
      return `0 0 */${days} * *`;
    }
  }

  async executeJob(jobId) {
    if (this.runningJobs.has(jobId)) {
      console.log(`⚠️ Job ${jobId} is already running, skipping execution`);
      return;
    }

    const startTime = Date.now();
    
    // Set job status to running and emit real-time update
    this.runningJobs.set(jobId, {
      status: 'running',
      startTime,
      progress: 0
    });

    this.emitJobStatusUpdate(jobId, {
      status: 'running',
      message: 'Job execution started',
      progress: 0
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
      const totalSwitches = switches.length;
      let completedSwitches = 0;

      // Scan each switch
      for (const switchConfig of switches) {
        try {
          console.log(`🔍 Scanning switch: ${switchConfig.name} (${switchConfig.host})`);
          
          // Update progress
          const progress = Math.floor((completedSwitches / totalSwitches) * 100);
          this.runningJobs.set(jobId, {
            ...this.runningJobs.get(jobId),
            progress,
            currentSwitch: switchConfig.name
          });

          this.emitJobStatusUpdate(jobId, {
            status: 'running',
            message: `Scanning switch: ${switchConfig.name}`,
            progress,
            currentSwitch: switchConfig.name
          });
          
          const macAddresses = await this.sshService.scanMacAddresses(
            switchConfig,
            job.vlan_id
          );

          totalDevicesFound += macAddresses.length;

          // Process each MAC address
          for (const macAddress of macAddresses) {
            await this.processDevice(job, switchConfig, macAddress);
          }

          // Update device statuses
          await this.updateDeviceStatuses(jobId, switchConfig.id, macAddresses);

          completedSwitches++;

        } catch (error) {
          console.error(`❌ Failed to scan switch ${switchConfig.name}:`, error);
          errors.push(`Switch ${switchConfig.name}: ${error.message}`);
          completedSwitches++;
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

      // Emit completion status
      this.emitJobStatusUpdate(jobId, {
        status: 'completed',
        message: `Job completed successfully. Found ${totalDevicesFound} devices.`,
        progress: 100,
        devicesFound: totalDevicesFound,
        newDevices,
        unauthorizedDevices
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

      // Send error notification
      await this.notificationService.createNotification({
        jobId,
        type: 'error',
        title: 'Job Execution Failed',
        message: `Job execution failed: ${error.message}`,
        severity: 'error'
      });

      // Emit error status
      this.emitJobStatusUpdate(jobId, {
        status: 'failed',
        message: `Job failed: ${error.message}`,
        progress: 0,
        error: error.message
      });

    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  emitJobStatusUpdate(jobId, statusData) {
    // Emit real-time job status update
    if (this.jobStatusEmitter && this.jobStatusEmitter.broadcastJobStatus) {
      this.jobStatusEmitter.broadcastJobStatus(jobId, statusData);
    }
  }

  getJobStatus(jobId) {
    return this.runningJobs.get(jobId) || null;
  }

  isJobRunning(jobId) {
    return this.runningJobs.has(jobId);
  }

  async processDevice(job, switchConfig, macAddress) {
    try {
      // Check if device exists
      const existingDevice = await this.database.get(
        'SELECT * FROM known_devices WHERE job_id = ? AND mac_address = ? AND switch_id = ?',
        [job.id, macAddress, switchConfig.id]
      );

      if (existingDevice) {
        // Update last seen and status
        await this.database.run(
          'UPDATE known_devices SET last_seen = CURRENT_TIMESTAMP, status = "online" WHERE id = ?',
          [existingDevice.id]
        );
      } else {
        // Check if device is in whitelist
        const whitelistEntry = await this.database.get(
          'SELECT * FROM whitelist WHERE job_id = ? AND mac_address = ?',
          [job.id, macAddress]
        );

        const isAuthorized = !!whitelistEntry;

        // Create new device
        const deviceId = uuidv4();
        await this.database.run(
          `INSERT INTO known_devices 
           (id, job_id, mac_address, switch_id, vlan_id, is_authorized, status, device_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceId,
            job.id,
            macAddress,
            switchConfig.id,
            job.vlan_id,
            isAuthorized,
            'online',
            whitelistEntry?.device_name || null
          ]
        );

        console.log(`📱 New device discovered: ${macAddress} (${isAuthorized ? 'authorized' : 'unauthorized'})`);
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
    if (this.scheduledJobs.has(jobId)) {
      this.scheduledJobs.get(jobId).destroy();
      this.scheduledJobs.delete(jobId);
      console.log(`📅 Unscheduled job ${jobId}`);
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
      scheduledJob.destroy();
    }
    
    this.scheduledJobs.clear();
    console.log('✅ Job scheduler shutdown complete');
  }
}