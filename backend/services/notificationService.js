import { v4 as uuidv4 } from 'uuid';

export class NotificationService {
  constructor() {
    this.wss = null;
    this.database = null;
  }

  setWebSocketServer(wss) {
    this.wss = wss;
  }

  setDatabase(database) {
    this.database = database;
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

      // Save to database if available
      if (this.database) {
        await this.database.run(
          `INSERT INTO notifications (id, job_id, type, title, message, severity, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [notificationId, jobId, type, title, message, severity, 0, notification.created_at]
        );
      }

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
          try {
            client.send(message);
          } catch (error) {
            console.error('Failed to send notification to client:', error);
          }
        }
      });
    }
  }

  broadcastJobStatus(jobId, statusData) {
    if (this.wss) {
      const message = JSON.stringify({
        type: 'job_status',
        jobId,
        data: statusData
      });

      this.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          try {
            client.send(message);
          } catch (error) {
            console.error('Failed to send job status to client:', error);
          }
        }
      });
    }
  }

  broadcastDeviceUpdate(jobId, deviceData) {
    if (this.wss) {
      const message = JSON.stringify({
        type: 'device_update',
        jobId,
        data: deviceData
      });

      this.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          try {
            client.send(message);
          } catch (error) {
            console.error('Failed to send device update to client:', error);
          }
        }
      });
    }
  }

  async getNotifications(limit = 50, offset = 0) {
    if (!this.database) {
      return [];
    }

    try {
      return await this.database.all(
        'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId) {
    if (!this.database) {
      return false;
    }

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

  async deleteNotification(notificationId) {
    if (!this.database) {
      return false;
    }

    try {
      await this.database.run(
        'DELETE FROM notifications WHERE id = ?',
        [notificationId]
      );
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }
}