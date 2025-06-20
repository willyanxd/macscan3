import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { notifications: wsNotifications } = useWebSocket();

  useEffect(() => {
    fetchNotificationCounts();
  }, []);

  useEffect(() => {
    // Update unread count when new notifications arrive via WebSocket
    if (wsNotifications.length > 0) {
      const latestNotification = wsNotifications[0];
      if (!latestNotification.is_read) {
        setUnreadCount(prev => prev + 1);
        setTotalCount(prev => prev + 1);
      }
    }
  }, [wsNotifications]);

  useEffect(() => {
    // Listen for bulk notification updates
    const handleNotificationsUpdated = (event: CustomEvent) => {
      const { action } = event.detail;
      if (action === 'mark_all_read') {
        setUnreadCount(0);
      } else if (action === 'delete_all') {
        setUnreadCount(0);
        setTotalCount(0);
      }
    };

    window.addEventListener('notifications_updated', handleNotificationsUpdated as EventListener);
    
    return () => {
      window.removeEventListener('notifications_updated', handleNotificationsUpdated as EventListener);
    };
  }, []);

  const fetchNotificationCounts = async () => {
    try {
      const response = await api.get('/notifications/counts');
      setUnreadCount(response.data.unread);
      setTotalCount(response.data.total);
    } catch (error) {
      console.error('Failed to fetch notification counts:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setTotalCount(prev => Math.max(0, prev - 1));
      // Note: We don't know if the deleted notification was read or not,
      // so we refresh the counts to be accurate
      fetchNotificationCounts();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      await api.delete('/notifications');
      setUnreadCount(0);
      setTotalCount(0);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  return {
    unreadCount,
    totalCount,
    refreshCounts: fetchNotificationCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  };
}