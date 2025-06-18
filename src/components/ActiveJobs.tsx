import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Settings, Users, Server, Clock } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { formatDistanceToNow } from 'date-fns';

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

  useEffect(() => {
    fetchActiveJobs();
  }, []);

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
      await api.post(`/jobs/${jobId}/execute`);
      // Show success message
    } catch (error) {
      console.error('Failed to execute job:', error);
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
        {jobs.slice(0, 5).map((job) => (
          <div key={job.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
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
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {job.last_execution && (
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(job.last_execution))} ago
                </span>
              )}
              <Button
                size="sm"
                onClick={() => executeJob(job.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No active jobs found
        </div>
      )}
    </div>
  );
}