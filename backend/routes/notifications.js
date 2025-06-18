export function notificationRoutes(app, database, notificationService) {
  // Get all notifications
  app.get('/api/notifications', async (req, res) => {
    try {
      const { limit = 50, offset = 0, unread_only = false } = req.query;

      let query = 'SELECT n.*, j.name as job_name FROM notifications n LEFT JOIN jobs j ON n.job_id = j.id';
      const params = [];

      if (unread_only === 'true') {
        query += ' WHERE n.is_read = 0';
      }

      query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const notifications = await database.all(query, params);
      res.json(notifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;

      await database.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      await database.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Delete notification
  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      const { id } = req.params;

      await database.run('DELETE FROM notifications WHERE id = ?', [id]);
      res.json({ message: 'Notification deleted' });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // Get notification counts
  app.get('/api/notifications/counts', async (req, res) => {
    try {
      const totalResult = await database.get('SELECT COUNT(*) as count FROM notifications');
      const unreadResult = await database.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');

      res.json({
        total: totalResult.count,
        unread: unreadResult.count
      });
    } catch (error) {
      console.error('Failed to get notification counts:', error);
      res.status(500).json({ error: 'Failed to get notification counts' });
    }
  });
}