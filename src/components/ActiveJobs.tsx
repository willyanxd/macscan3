import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Settings, Users, Server, Clock, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '../contexts/WebSocketContext';

interface ActiveJob {
  id: string;
  name: string;
  vlan_id: number;
  schedule_type: string;
  schedule_interval: number;
  is_active: boolean;
  switch_count: number;
  device_count: number;
  last_execution: string;
}

export function ActiveJobs() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingJobs, setExecutingJobs] = useState<Set<string>>(new Set());
  const { jobStatuses } = useWebSocket();

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  // Update job execution states based on WebSocket status
  useEffect(() => {
    const newExecutingJobs = new Set<string>();
    
    jobStatuses.forEach((status, jobId) => {
      if (status.status === 'running' || status.status === 'scanning') {
        newExecutingJobs.add(jobId);
      }
    });
    
    setExecutingJobs(newExecutingJobs);
    
    // Refresh jobs list when jobs complete
    const completedJobs = Array.from(jobStatuses.values()).filter(
      status => status.status === 'completed' || status.status === 'failed'
    );
    
    if (completedJobs.length > 0) {
      setTimeout(() => {
        fetchActiveJobs();
      }, 1000);
    }
  }, [jobStatuses]);

  const fetchActiveJobs = async () => {
    try {
      const response = await api.get('/dashboard/active-jobs');
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch active jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeJob = async (jobId: string) => {
    try {
      setExecutingJobs(prev => new Set(prev).add(jobId));
      await api.post(`/jobs/${jobId}/execute`);
    } catch (error) {
      console.error('Failed to execute job:', error);
      setExecutingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const getJobStatus = (jobId: string) => {
    const status = jobStatuses.get(jobId);
    if (!status) return null;
    
    switch (status.status) {
      case 'running':
        return { icon: Loader2, text: 'Starting...', color: 'text-blue-400', spin: true };
      case 'scanning':
        return { 
          icon: Loader2, 
          text: status.switchName ? `Scanning ${status.switchName}` : 'Scanning...', 
          color: 'text-cyan-400', 
          spin: true 
        };
      case 'completed':
        return { icon: CheckCircle, text: 'Completed', color: 'text-green-400', spin: false };
      case 'failed':
        return { icon: XCircle, text: 'Failed', color: 'text-red-400', spin: false };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Active Jobs</h2>
        <Link to="/jobs">
          <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 hover:text-white">
            View All
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {jobs.slice(0, 5).map((job) => {
          const isExecuting = executingJobs.has(job.id);
          const jobStatus = getJobStatus(job.id);
          
          return (
            <div key={job.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-cyan-500/30 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {jobStatus ? (
                    <div className="flex items-center space-x-2">
                      <jobStatus.icon className={`w-4 h-4 ${jobStatus.color} ${jobStatus.spin ? 'animate-spin' : ''}`} />
                    </div>
                  ) : (
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                
                <div>
                  <Link to={`/jobs/${job.id}`} className="text-white font-medium hover:text-cyan-400 transition-colors">
                    {job.name}
                  </Link>
                  <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Server className="h-3 w-3" />
                      <span>{job.switch_count} switches</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{job.device_count} devices</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {job.schedule_type === 'manual' ? 'Manual' : `${job.schedule_interval}min`}
                      </span>
                    </div>
                  </div>
                  {jobStatus && (
                    <div className={`text-xs mt-1 ${jobStatus.color}`}>
                      {jobStatus.text}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {job.last_execution && !isExecuting && !jobStatus && (
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(job.last_execution))} ago
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={() => executeJob(job.id)}
                  disabled={isExecuting}
                  className={`${isExecuting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} disabled:opacity-50`}
                >
                  {isExecuting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No active jobs found
        </div>
      )}
    </div>
  );
}