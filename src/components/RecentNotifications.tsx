import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  job_id: string;
  job_name: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
}

export function RecentNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentNotifications();
  }, []);

  const fetchRecentNotifications = async () => {
    try {
      const response = await api.get('/dashboard/recent-notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to fetch recent notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      default:
        return <Info className="h-4 w-4 text-blue-400" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Recent Notifications</h2>
        <Link to="/notifications">
          <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 hover:text-white">
            View All
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div key={notification.id} className={`p-3 rounded-lg border transition-colors ${
            notification.is_read 
              ? 'bg-gray-700/30 border-gray-600' 
              : 'bg-gray-700/50 border-cyan-500/30'
          }`}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(notification.severity)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium truncate ${
                    notification.is_read ? 'text-gray-300' : 'text-white'
                  }`}>
                    {notification.title}
                  </p>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-cyan-500 rounded-full flex-shrink-0 ml-2"></div>
                  )}
                </div>
                
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {notification.message}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-cyan-400">
                    {notification.job_name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(notification.created_at))} ago
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent notifications</p>
        </div>
      )}
    </div>
  );
}