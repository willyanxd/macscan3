import { v4 as uuidv4 } from 'uuid';

export class NotificationService {
  constructor() {
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

      // This would normally save to database
      // For now, just broadcast via WebSocket
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

  broadcastJobProgress(jobId, progress) {
    if (this.wss) {
      const message = JSON.stringify({
        type: 'job_progress',
        data: {
          jobId,
          progress
        }
      });

      this.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    }
  }

  async getNotifications(limit = 50, offset = 0) {
    // This would normally fetch from database
    return [];
  }

  async markAsRead(notificationId) {
    // This would normally update database
    return true;
  }

  async deleteNotification(notificationId) {
    // This would normally delete from database
    return true;
  }
}