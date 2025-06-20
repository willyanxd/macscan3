import { v4 as uuidv4 } from 'uuid';

export function jobRoutes(app, database, jobScheduler) {
  // Get all jobs
  app.get('/api/jobs', async (req, res) => {
    try {
      const jobs = await database.all(`
        SELECT j.*, COUNT(s.id) as switch_count
        FROM jobs j
        LEFT JOIN switches s ON j.id = s.job_id
        GROUP BY j.id
        ORDER BY j.created_at DESC
      `);
      
      res.json(jobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  // Get job by ID with enhanced details
  app.get('/api/jobs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const job = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const switches = await database.all('SELECT * FROM switches WHERE job_id = ?', [id]);
      const deviceCount = await database.get(
        'SELECT COUNT(*) as count FROM known_devices WHERE job_id = ?',
        [id]
      );
      const lastExecution = await database.get(
        'SELECT * FROM job_history WHERE job_id = ? ORDER BY execution_time DESC LIMIT 1',
        [id]
      );

      // Get next run time for scheduled jobs
      let nextRunTime = null;
      if (job.schedule_type === 'interval' && job.schedule_interval && job.is_active) {
        try {
          nextRunTime = await jobScheduler.getNextRunTime(id);
        } catch (error) {
          console.error('Failed to get next run time:', error);
        }
      }

      res.json({
        ...job,
        switches,
        device_count: deviceCount.count,
        last_execution: lastExecution,
        next_run_time: nextRunTime
      });
    } catch (error) {
      console.error('Failed to fetch job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
    }
  });

  // Create new job
  app.post('/api/jobs', async (req, res) => {
    try {
      const {
        name,
        vlan_id,
        schedule_type = 'manual',
        schedule_interval,
        retention_policy = '7days',
        notifications_enabled = true,
        warning_notifications = true,
        switches = []
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Job name is required' });
      }

      if (!vlan_id) {
        return res.status(400).json({ error: 'VLAN ID is required' });
      }

      if (switches.length === 0) {
        return res.status(400).json({ error: 'At least one switch is required' });
      }

      const jobId = uuidv4();
      
      // Start transaction
      await database.run('BEGIN TRANSACTION');

      try {
        // Create job
        await database.run(
          `INSERT INTO jobs 
           (id, name, vlan_id, schedule_type, schedule_interval, retention_policy, 
            notifications_enabled, warning_notifications)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            jobId,
            name,
            vlan_id,
            schedule_type,
            schedule_interval,
            retention_policy,
            notifications_enabled,
            warning_notifications
          ]
        );

        // Create switches with SNMP configuration
        for (const switchConfig of switches) {
          const switchId = uuidv4();
          await database.run(
            'INSERT INTO switches (id, job_id, name, host, community, version) VALUES (?, ?, ?, ?, ?, ?)',
            [
              switchId,
              jobId,
              switchConfig.name,
              switchConfig.host,
              switchConfig.community || 'public',
              switchConfig.version || '2c'
            ]
          );
        }

        await database.run('COMMIT');

        // Schedule job if not manual
        if (schedule_type !== 'manual') {
          const job = await database.get('SELECT * FROM jobs WHERE id = ?', [jobId]);
          await jobScheduler.scheduleJob(job);
        }

        res.status(201).json({ id: jobId, message: 'Job created successfully' });
      } catch (error) {
        await database.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      res.status(500).json({ error: 'Failed to create job: ' + error.message });
    }
  });

  // Update job (preserving ID and history) - FIXED: Preserve devices and handle schedule changes
  app.put('/api/jobs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        vlan_id,
        schedule_type,
        schedule_interval,
        retention_policy,
        notifications_enabled,
        warning_notifications,
        switches = []
      } = req.body;

      // Check if job exists
      const existingJob = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!existingJob) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Start transaction
      await database.run('BEGIN TRANSACTION');

      try {
        // Update job (preserving ID and timestamps)
        await database.run(
          `UPDATE jobs SET 
           name = ?, vlan_id = ?, schedule_type = ?, schedule_interval = ?,
           retention_policy = ?, notifications_enabled = ?, warning_notifications = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [
            name,
            vlan_id,
            schedule_type,
            schedule_interval,
            retention_policy,
            notifications_enabled,
            warning_notifications,
            id
          ]
        );

        // Update switches (remove old ones and add new ones)
        // First, get existing switch IDs to preserve device associations
        const existingSwitches = await database.all('SELECT id FROM switches WHERE job_id = ?', [id]);
        
        // Delete old switches (this will cascade to devices due to foreign key)
        await database.run('DELETE FROM switches WHERE job_id = ?', [id]);
        
        // Add new switches
        for (const switchConfig of switches) {
          const switchId = uuidv4();
          await database.run(
            'INSERT INTO switches (id, job_id, name, host, community, version) VALUES (?, ?, ?, ?, ?, ?)',
            [
              switchId,
              id,
              switchConfig.name,
              switchConfig.host,
              switchConfig.community || 'public',
              switchConfig.version || '2c'
            ]
          );
        }

        await database.run('COMMIT');

        // Handle schedule changes
        const scheduleChanged = existingJob.schedule_type !== schedule_type || 
                               existingJob.schedule_interval !== schedule_interval;

        if (scheduleChanged) {
          // Always unschedule first
          await jobScheduler.unscheduleJob(id);
          
          // Only reschedule if new type is not manual
          if (schedule_type !== 'manual' && schedule_interval) {
            const updatedJob = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
            await jobScheduler.scheduleJob(updatedJob);
          }
        }

        res.json({ message: 'Job updated successfully' });
      } catch (error) {
        await database.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Failed to update job:', error);
      res.status(500).json({ error: 'Failed to update job: ' + error.message });
    }
  });

  // Delete job - FIXED: Proper error handling and comprehensive cleanup
  app.delete('/api/jobs/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Validate job exists
      const job = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      console.log(`🗑️ Starting deletion of job ${id} (${job.name})`);

      // Start transaction for atomic deletion
      await database.run('BEGIN TRANSACTION');

      try {
        // 1. Unschedule job first (before any database operations)
        try {
          await jobScheduler.unscheduleJob(id);
          console.log(`✅ Job ${id} unscheduled successfully`);
        } catch (scheduleError) {
          console.error(`⚠️ Warning: Failed to unschedule job ${id}:`, scheduleError.message);
          // Continue with deletion even if unscheduling fails
        }

        // 2. Delete in correct order to respect foreign key constraints
        
        // Delete notifications
        const notificationsResult = await database.run('DELETE FROM notifications WHERE job_id = ?', [id]);
        console.log(`🗑️ Deleted ${notificationsResult.changes} notifications`);

        // Delete whitelist entries
        const whitelistResult = await database.run('DELETE FROM whitelist WHERE job_id = ?', [id]);
        console.log(`🗑️ Deleted ${whitelistResult.changes} whitelist entries`);

        // Delete job history
        const historyResult = await database.run('DELETE FROM job_history WHERE job_id = ?', [id]);
        console.log(`🗑️ Deleted ${historyResult.changes} history entries`);

        // Delete known devices
        const devicesResult = await database.run('DELETE FROM known_devices WHERE job_id = ?', [id]);
        console.log(`🗑️ Deleted ${devicesResult.changes} known devices`);

        // Delete switches
        const switchesResult = await database.run('DELETE FROM switches WHERE job_id = ?', [id]);
        console.log(`🗑️ Deleted ${switchesResult.changes} switches`);

        // Finally, delete the job itself
        const jobResult = await database.run('DELETE FROM jobs WHERE id = ?', [id]);
        
        if (jobResult.changes === 0) {
          await database.run('ROLLBACK');
          return res.status(404).json({ error: 'Job not found or already deleted' });
        }

        console.log(`🗑️ Deleted job ${id}`);

        // Commit transaction
        await database.run('COMMIT');
        
        console.log(`✅ Job ${id} (${job.name}) deleted successfully`);
        res.json({ 
          message: 'Job deleted successfully',
          details: {
            notifications: notificationsResult.changes,
            whitelist: whitelistResult.changes,
            history: historyResult.changes,
            devices: devicesResult.changes,
            switches: switchesResult.changes
          }
        });
        
      } catch (dbError) {
        await database.run('ROLLBACK');
        console.error(`❌ Database error during job deletion:`, dbError);
        throw dbError;
      }
    } catch (error) {
      console.error(`❌ Failed to delete job ${id}:`, error);
      res.status(500).json({ 
        error: 'Failed to delete job', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Execute job manually
  app.post('/api/jobs/:id/execute', async (req, res) => {
    try {
      const { id } = req.params;

      const job = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Execute job in background
      jobScheduler.executeJob(id).catch(error => {
        console.error(`Background job execution failed for ${id}:`, error);
      });

      res.json({ message: 'Job execution started' });
    } catch (error) {
      console.error('Failed to execute job:', error);
      res.status(500).json({ error: 'Failed to execute job' });
    }
  });

  // Get job history
  app.get('/api/jobs/:id/history', async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const history = await database.all(
        'SELECT * FROM job_history WHERE job_id = ? ORDER BY execution_time DESC LIMIT ? OFFSET ?',
        [id, parseInt(limit), parseInt(offset)]
      );

      res.json(history);
    } catch (error) {
      console.error('Failed to fetch job history:', error);
      res.status(500).json({ error: 'Failed to fetch job history' });
    }
  });

  // Get job whitelist
  app.get('/api/jobs/:id/whitelist', async (req, res) => {
    try {
      const { id } = req.params;

      const whitelist = await database.all(
        'SELECT * FROM whitelist WHERE job_id = ? ORDER BY added_at DESC',
        [id]
      );

      res.json(whitelist);
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
      res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
  });

  // Add to job whitelist
  app.post('/api/jobs/:id/whitelist', async (req, res) => {
    try {
      const { id } = req.params;
      const { mac_address, device_name } = req.body;

      if (!mac_address) {
        return res.status(400).json({ error: 'MAC address is required' });
      }

      const whitelistId = uuidv4();
      await database.run(
        'INSERT OR REPLACE INTO whitelist (id, job_id, mac_address, device_name) VALUES (?, ?, ?, ?)',
        [whitelistId, id, mac_address, device_name || null]
      );

      // Update existing devices
      await database.run(
        'UPDATE known_devices SET is_authorized = 1, device_name = ? WHERE job_id = ? AND mac_address = ?',
        [device_name || null, id, mac_address]
      );

      res.status(201).json({ message: 'Device added to whitelist' });
    } catch (error) {
      console.error('Failed to add to whitelist:', error);
      res.status(500).json({ error: 'Failed to add to whitelist' });
    }
  });

  // Remove from job whitelist
  app.delete('/api/jobs/:jobId/whitelist/:id', async (req, res) => {
    try {
      const { jobId, id } = req.params;

      const whitelistEntry = await database.get('SELECT * FROM whitelist WHERE id = ? AND job_id = ?', [id, jobId]);
      if (!whitelistEntry) {
        return res.status(404).json({ error: 'Whitelist entry not found' });
      }

      await database.run('DELETE FROM whitelist WHERE id = ?', [id]);

      // Update corresponding devices
      await database.run(
        'UPDATE known_devices SET is_authorized = 0 WHERE job_id = ? AND mac_address = ?',
        [jobId, whitelistEntry.mac_address]
      );

      res.json({ message: 'Device removed from whitelist' });
    } catch (error) {
      console.error('Failed to remove from whitelist:', error);
      res.status(500).json({ error: 'Failed to remove from whitelist' });
    }
  });

  // Get next run times for scheduled jobs
  app.get('/api/jobs/:id/next-runs', async (req, res) => {
    try {
      const { id } = req.params;
      const { count = 5 } = req.query;

      const job = await database.get('SELECT * FROM jobs WHERE id = ?', [id]);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.schedule_type === 'manual' || !job.is_active) {
        return res.json({ next_runs: [] });
      }

      try {
        const nextRuns = await jobScheduler.getNextRunTimes(id, parseInt(count));
        res.json({ next_runs: nextRuns });
      } catch (error) {
        console.error('Failed to get next run times:', error);
        res.json({ next_runs: [] });
      }
    } catch (error) {
      console.error('Failed to fetch next run times:', error);
      res.status(500).json({ error: 'Failed to fetch next run times' });
    }
  });
}