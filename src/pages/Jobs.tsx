import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Pause, Edit, Trash2, Server, Users, Clock, Loader, Activity } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/Button';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  name: string;
  vlan_id: number;
  schedule_type: string;
  schedule_interval: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  switch_count: number;
}

export function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingJobs, setExecutingJobs] = useState<Set<string>>(new Set());
  const { jobProgress } = useWebSocket();

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    // Update executing jobs based on progress
    const newExecutingJobs = new Set<string>();
    jobProgress.forEach((progress, jobId) => {
      if (progress.status === 'starting' || progress.status === 'running' || progress.status === 'processing') {
        newExecutingJobs.add(jobId);
      }
    });
    setExecutingJobs(newExecutingJobs);
  }, [jobProgress]);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs');
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeJob = async (jobId: string) => {
    try {
      setExecutingJobs(prev => new Set(prev).add(jobId));
      
      const response = await api.post(`/jobs/${jobId}/execute`);
      
      if (response.data.status === 'running') {
        // Job is already running
        setExecutingJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(jobId);
          return newSet;
        });
        alert('Job is already running');
      }
      // If successful, the job will be tracked via WebSocket progress updates
    } catch (error) {
      console.error('Failed to execute job:', error);
      setExecutingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      alert('Failed to start job execution');
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      await api.delete(`/jobs/${jobId}`);
      setJobs(jobs.filter(job => job.id !== jobId));
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  const getJobProgress = (jobId: string) => {
    return jobProgress.get(jobId);
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
            Jobs
          </h1>
          <p className="text-gray-400 mt-1">Manage your network scanning jobs</p>
        </div>
        <Link to="/jobs/create">
          <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600">
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </Link>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {jobs.map((job) => {
          const isExecuting = executingJobs.has(job.id);
          const progress = getJobProgress(job.id);
          
          return (
            <div key={job.id} className="bg-gray-800 rounded-xl border border-gray-700 hover:border-cyan-500/30 transition-all duration-200 group">
              <div className="p-6">
                {/* Job Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                      {job.name}
                    </h3>
                    <p className="text-sm text-gray-400">VLAN {job.vlan_id}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {isExecuting && (
                      <div className="flex items-center space-x-1">
                        <Activity className="h-4 w-4 text-cyan-400 animate-pulse" />
                        <span className="text-xs text-cyan-400">Running</span>
                      </div>
                    )}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.is_active 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {job.is_active ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>

                {/* Job Progress */}
                {progress && (
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-cyan-500/30">
                    <div className="flex justify-between text-sm text-gray-300 mb-2">
                      <span className="truncate">{progress.currentStep}</span>
                      <span>{progress.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress.progress}%` }}
                      ></div>
                    </div>
                    {progress.switchesCompleted > 0 && (
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{progress.switchesCompleted}/{progress.totalSwitches} switches</span>
                        <span>{progress.devicesFound} devices found</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Job Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Server className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-gray-300">{job.switch_count} switches</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-gray-300">
                      {job.schedule_type === 'manual' ? 'Manual' : `${job.schedule_interval}min`}
                    </span>
                  </div>
                </div>

                {/* Job Info */}
                <div className="text-xs text-gray-500 mb-4">
                  Created {formatDistanceToNow(new Date(job.created_at))} ago
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={() => executeJob(job.id)}
                    disabled={isExecuting}
                    className="bg-green-600 hover:bg-green-700 flex-1 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <Loader className="h-3 w-3 mr-1 animate-spin" />
                        Running
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </>
                    )}
                  </Button>
                  <Link to={`/jobs/${job.id}`}>
                    <Button size="sm" variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                      <Edit className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteJob(job.id)}
                    disabled={isExecuting}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-12">
          <Server className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No jobs yet</h3>
          <p className="text-gray-500 mb-4">Create your first network scanning job to get started.</p>
          <Link to="/jobs/create">
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Job
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}