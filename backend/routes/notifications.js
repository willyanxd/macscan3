export function notificationRoutes(app, database, notificationService) {
  // Get all notifications
  app.get('/api/notifications', async (req, res) => {
    try {
      const { limit = 50, offset = 0, unread_only = false } = req.query;
      const notifications = await notificationService.getNotifications(
        parseInt(limit), 
        parseInt(offset), 
        unread_only === 'true'
      );
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
      const success = await notificationService.markAsRead(id);
      
      if (success) {
        res.json({ message: 'Notification marked as read' });
      } else {
        res.status(500).json({ error: 'Failed to mark notification as read' });
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      const success = await notificationService.markAllAsRead();
      
      if (success) {
        // Broadcast update to all clients
        notificationService.broadcastNotification({
          type: 'notifications_updated',
          data: { action: 'mark_all_read' }
        });
        res.json({ message: 'All notifications marked as read' });
      } else {
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Delete notification
  app.delete('/api/notifications/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const success = await notificationService.deleteNotification(id);
      
      if (success) {
        res.json({ message: 'Notification deleted' });
      } else {
        res.status(500).json({ error: 'Failed to delete notification' });
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // Delete all notifications
  app.delete('/api/notifications', async (req, res) => {
    try {
      const success = await notificationService.deleteAllNotifications();
      
      if (success) {
        // Broadcast update to all clients
        notificationService.broadcastNotification({
          type: 'notifications_updated',
          data: { action: 'delete_all' }
        });
        res.json({ message: 'All notifications deleted' });
      } else {
        res.status(500).json({ error: 'Failed to delete all notifications' });
      }
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      res.status(500).json({ error: 'Failed to delete all notifications' });
    }
  });

  // Get notification counts
  app.get('/api/notifications/counts', async (req, res) => {
    try {
      const counts = await notificationService.getNotificationCounts();
      res.json(counts);
    } catch (error) {
      console.error('Failed to get notification counts:', error);
      res.status(500).json({ error: 'Failed to get notification counts' });
    }
  });
}