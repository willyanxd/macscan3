import React from 'react';
import { Play, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '../contexts/WebSocketContext';

interface JobStatusIndicatorProps {
  jobId: string;
  className?: string;
}

export function JobStatusIndicator({ jobId, className = '' }: JobStatusIndicatorProps) {
  const { jobStatuses } = useWebSocket();
  const status = jobStatuses.get(jobId);

  if (!status) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'completed':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'failed':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    }
  };

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-lg border ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <div className="flex flex-col">
        <span className="text-xs font-medium capitalize">{status.status}</span>
        {status.progress > 0 && status.status === 'running' && (
          <div className="w-16 h-1 bg-gray-600 rounded-full mt-1">
            <div 
              className="h-full bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}
      </div>
      {status.status === 'running' && status.currentSwitch && (
        <span className="text-xs text-gray-400 max-w-20 truncate">
          {status.currentSwitch}
        </span>
      )}
    </div>
  );
}