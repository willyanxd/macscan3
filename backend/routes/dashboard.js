export function dashboardRoutes(app, database) {
  // Get dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = await Promise.all([
        // Total jobs
        database.get('SELECT COUNT(*) as count FROM jobs WHERE is_active = 1'),
        
        // Active jobs (running)
        database.get(`
          SELECT COUNT(DISTINCT job_id) as count 
          FROM job_history 
          WHERE execution_time >= datetime('now', '-1 hour') 
          AND status = 'success'
        `),
        
        // Total devices
        database.get('SELECT COUNT(*) as count FROM known_devices'),
        
        // Unauthorized devices
        database.get('SELECT COUNT(*) as count FROM known_devices WHERE is_authorized = 0 AND status = "online"'),
        
        // Unread notifications
        database.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'),
        
        // Recent warnings
        database.get(`
          SELECT COUNT(*) as count 
          FROM notifications 
          WHERE severity = 'warning' 
          AND created_at >= datetime('now', '-24 hours')
        `)
      ]);

      res.json({
        total_jobs: stats[0].count,
        active_jobs: stats[1].count,
        total_devices: stats[2].count,
        unauthorized_devices: stats[3].count,
        unread_notifications: stats[4].count,
        recent_warnings: stats[5].count
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Get recent job activity
  app.get('/api/dashboard/recent-activity', async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const recentActivity = await database.all(`
        SELECT 
          jh.*,
          j.name as job_name
        FROM job_history jh
        LEFT JOIN jobs j ON jh.job_id = j.id
        ORDER BY jh.execution_time DESC
        LIMIT ?
      `, [parseInt(limit)]);

      res.json(recentActivity);
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
  });

  // Get active jobs
  app.get('/api/dashboard/active-jobs', async (req, res) => {
    try {
      const activeJobs = await database.all(`
        SELECT 
          j.*,
          COUNT(DISTINCT s.id) as switch_count,
          COUNT(DISTINCT kd.id) as device_count,
          MAX(jh.execution_time) as last_execution
        FROM jobs j
        LEFT JOIN switches s ON j.id = s.job_id
        LEFT JOIN known_devices kd ON j.id = kd.job_id
        LEFT JOIN job_history jh ON j.id = jh.job_id
        WHERE j.is_active = 1
        GROUP BY j.id
        ORDER BY j.updated_at DESC
      `);

      res.json(activeJobs);
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
      res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
  });

  // Get recent notifications
  app.get('/api/dashboard/recent-notifications', async (req, res) => {
    try {
      const { limit = 5 } = req.query;

      const recentNotifications = await database.all(`
        SELECT 
          n.*,
          j.name as job_name
        FROM notifications n
        LEFT JOIN jobs j ON n.job_id = j.id
        ORDER BY n.created_at DESC
        LIMIT ?
      `, [parseInt(limit)]);

      res.json(recentNotifications);
    } catch (error) {
      console.error('Failed to fetch recent notifications:', error);
      res.status(500).json({ error: 'Failed to fetch recent notifications' });
    }
  });
}