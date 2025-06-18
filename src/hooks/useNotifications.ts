import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const { notifications: wsNotifications } = useWebSocket();

  useEffect(() => {
    fetchNotificationCounts();
  }, []);

  useEffect(() => {
    // Update unread count when new notifications arrive via WebSocket
    if (wsNotifications.length > 0) {
      setUnreadCount(prev => prev + 1);
    }
  }, [wsNotifications]);

  const fetchNotificationCounts = async () => {
    try {
      const response = await api.get('/notifications/counts');
      setUnreadCount(response.data.unread);
    } catch (error) {
      console.error('Failed to fetch notification counts:', error);
    }
  };

  return {
    unreadCount,
    refreshCounts: fetchNotificationCounts
  };
}