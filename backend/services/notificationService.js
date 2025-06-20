import { v4 as uuidv4 } from 'uuid';

export class NotificationService {
  constructor(database) {
    this.database = database;
    this.wss = null;
  }

  setWebSocketServer(wss) {
    this.wss = wss;
  }

  async createNotification(notificationData) {
    try {
      const { jobId, type, title, message, severity = 'info' } = notificationData;
      
      const notificationId = uuidv4();
      const notification = {
        id: notificationId,
        job_id: jobId,
        type,
        title,
        message,
        severity,
        is_read: false,
        created_at: new Date().toISOString()
      };

      // Save to database
      await this.database.run(
        `INSERT INTO notifications (id, job_id, type, title, message, severity, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          notification.id,
          notification.job_id,
          notification.type,
          notification.title,
          notification.message,
          notification.severity,
          notification.is_read ? 1 : 0,
          notification.created_at
        ]
      );

      // Broadcast via WebSocket
      this.broadcastNotification(notification);

      return notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  broadcastNotification(notification) {
    if (this.wss) {
      const message = JSON.stringify({
        type: 'notification',
        data: notification
      });

      this.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    }
  }

  async broadcastJobStatus(jobId, status, data = {}) {
    if (this.wss) {
      const message = JSON.stringify({
        type: 'job_status',
        data: {
          jobId,
          status,
          timestamp: new Date().toISOString(),
          ...data
        }
      });

      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }
  }

  async getNotifications(limit = 50, offset = 0, unreadOnly = false) {
    try {
      let query = `
        SELECT n.*, j.name as job_name 
        FROM notifications n 
        LEFT JOIN jobs j ON n.job_id = j.id
      `;
      const params = [];

      if (unreadOnly) {
        query += ' WHERE n.is_read = 0';
      }

      query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      return await this.database.all(query, params);
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId) {
    try {
      await this.database.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ?',
        [notificationId]
      );
      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async markAllAsRead() {
    try {
      await this.database.run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  async deleteNotification(notificationId) {
    try {
      await this.database.run('DELETE FROM notifications WHERE id = ?', [notificationId]);
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  async deleteAllNotifications() {
    try {
      await this.database.run('DELETE FROM notifications');
      return true;
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      return false;
    }
  }

  async getNotificationCounts() {
    try {
      const totalResult = await this.database.get('SELECT COUNT(*) as count FROM notifications');
      const unreadResult = await this.database.get('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');

      return {
        total: totalResult?.count || 0,
        unread: unreadResult?.count || 0
      };
    } catch (error) {
      console.error('Failed to get notification counts:', error);
      return { total: 0, unread: 0 };
    }
  }
}