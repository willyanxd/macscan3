import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Trash2, AreaChart as MarkAsUnread, ExternalLink, Trash } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/Button';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../hooks/useNotifications';

interface Notification {
  id: string;
  job_id: string;
  job_name: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  useEffect(() => {
    // Listen for notification updates from WebSocket
    const handleNotificationsUpdated = () => {
      fetchNotifications();
    };

    window.addEventListener('notifications_updated', handleNotificationsUpdated);
    
    return () => {
      window.removeEventListener('notifications_updated', handleNotificationsUpdated);
    };
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      const params = filter === 'unread' ? { unread_only: true } : {};
      const response = await api.get('/notifications', { params });
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
    setNotifications(notifications.map(notif => 
      notif.id === notificationId ? { ...notif, is_read: true } : notif
    ));
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
    setNotifications(notifications.filter(notif => notif.id !== notificationId));
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    setNotifications(notifications.map(notif => ({ ...notif, is_read: true })));
  };

  const handleDeleteAllNotifications = async () => {
    if (!confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    
    await deleteAllNotifications();
    setNotifications([]);
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      default:
        return <Info className="h-5 w-5 text-blue-400" />;
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500/30';
      case 'warning':
        return 'border-yellow-500/30';
      case 'success':
        return 'border-green-500/30';
      default:
        return 'border-blue-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">Stay updated with your network activity</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Unread
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              className="border-gray-600 text-gray-400 hover:text-white"
            >
              <MarkAsUnread className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            
            <Button
              onClick={handleDeleteAllNotifications}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`bg-gray-800 rounded-xl border p-6 transition-all duration-200 ${
              notification.is_read ? 'border-gray-700' : `${getBorderColor(notification.severity)} bg-gray-800/50`
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">
                {getIcon(notification.severity)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-lg font-semibold ${
                    notification.is_read ? 'text-gray-300' : 'text-white'
                  }`}>
                    {notification.title}
                  </h3>
                  <div className="flex items-center space-x-2">
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                    )}
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(notification.created_at))} ago
                    </span>
                  </div>
                </div>
                
                <p className={`text-sm mb-3 ${
                  notification.is_read ? 'text-gray-400' : 'text-gray-300'
                }`}>
                  {notification.message}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">Job:</span>
                      <Link 
                        to={`/jobs/${notification.job_id}`}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1"
                      >
                        <span>{notification.job_name}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {!notification.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Mark Read
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteNotification(notification.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-gray-500">
            {filter === 'unread' 
              ? 'All caught up! Check back later for new updates.'
              : 'Notifications from your network scans will appear here.'
            }
          </p>
        </div>
      )}
    </div>
  );
}