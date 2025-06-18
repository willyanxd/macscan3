import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Users,
  Shield,
  Timer
} from 'lucide-react';
import { api } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';

interface JobHistoryItem {
  id: string;
  execution_time: string;
  status: string;
  devices_found: number;
  new_devices: number;
  unauthorized_devices: number;
  error_message: string | null;
  duration: number;
}

interface JobHistoryProps {
  jobId: string;
}

export function JobHistory({ jobId }: JobHistoryProps) {
  const [history, setHistory] = useState<JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobHistory();
  }, [jobId]);

  const fetchJobHistory = async () => {
    try {
      const response = await api.get(`/jobs/${jobId}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch job history:', error);
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

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div key={item.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(item.status)}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Execution on {format(new Date(item.execution_time), 'MMM dd, yyyy')}
                </h3>
                <p className="text-sm text-gray-400">
                  {format(new Date(item.execution_time), 'HH:mm:ss')} • {formatDistanceToNow(new Date(item.execution_time))} ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
              <div className="flex items-center space-x-1 text-sm text-gray-400">
                <Timer className="h-4 w-4" />
                <span>{formatDuration(item.duration)}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg">
              <Users className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Devices Found</p>
                <p className="text-lg font-semibold text-white">{item.devices_found}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg">
              <Shield className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">New Devices</p>
                <p className="text-lg font-semibold text-white">{item.new_devices}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-sm text-gray-400">Unauthorized</p>
                <p className="text-lg font-semibold text-white">{item.unauthorized_devices}</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {item.error_message && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">Error Details</span>
              </div>
              <p className="text-sm text-gray-300">{item.error_message}</p>
            </div>
          )}
        </div>
      ))}

      {history.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No execution history</h3>
          <p className="text-gray-500">This job hasn't been executed yet. Run it to see the history.</p>
        </div>
      )}
    </div>
  );
}