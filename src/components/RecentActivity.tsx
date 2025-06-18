import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

interface JobHistory {
  id: string;
  job_id: string;
  job_name: string;
  execution_time: string;
  status: string;
  devices_found: number;
  new_devices: number;
  unauthorized_devices: number;
  duration: number;
}

export function RecentActivity() {
  const [activity, setActivity] = useState<JobHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async () => {
    try {
      const response = await api.get('/dashboard/recent-activity');
      setActivity(response.data);
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-400" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'failed':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Recent Job Activity</h2>
        <Clock className="h-5 w-5 text-gray-400" />
      </div>

      <div className="space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
            <div className="flex-shrink-0">
              {getStatusIcon(item.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white truncate">
                  {item.job_name}
                </p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(item.status)}`}>
                  {item.status}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                <span>{item.devices_found} devices found</span>
                {item.new_devices > 0 && (
                  <span className="text-blue-400">{item.new_devices} new</span>
                )}
                {item.unauthorized_devices > 0 && (
                  <span className="text-red-400">{item.unauthorized_devices} unauthorized</span>
                )}
                <span>{formatDistanceToNow(new Date(item.execution_time))} ago</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activity.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No recent activity found
        </div>
      )}
    </div>
  );
}