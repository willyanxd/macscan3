import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Edit, 
  Trash2, 
  Users, 
  Server, 
  Clock, 
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Terminal,
  Settings,
  List,
  History,
  UserCheck,
  Loader2,
  StopCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/Button';
import { DevicesList } from '../components/DevicesList';
import { JobHistory } from '../components/JobHistory';
import { WhitelistManager } from '../components/WhitelistManager';
import { EditJobModal } from '../components/EditJobModal';
import { SwitchConsole } from '../components/SwitchConsole';
import { JobStatusIndicator } from '../components/JobStatusIndicator';
import { useWebSocket } from '../contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

interface JobDetails {
  id: string;
  name: string;
  vlan_id: number;
  schedule_type: string;
  schedule_interval: number;
  retention_policy: string;
  notifications_enabled: boolean;
  warning_notifications: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  switches: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
  }>;
  device_count: number;
  last_execution?: {
    execution_time: string;
    status: string;
    devices_found: number;
  };
  is_running?: boolean;
  job_status?: any;
}

export function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobStatuses } = useWebSocket();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('devices');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [selectedSwitch, setSelectedSwitch] = useState<any>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJobDetails();
      
      // Refresh job details every 30 seconds
      const interval = setInterval(fetchJobDetails, 30000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      const response = await api.get(`/jobs/${id}`);
      setJob(response.data);
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeJob = async () => {
    if (!id) return;
    
    setExecuting(true);
    try {
      const response = await api.post(`/jobs/${id}/execute`);
      
      if (response.data.status === 'started') {
        console.log('Job execution started successfully');
        // Status updates will come via WebSocket
      }
    } catch (error: any) {
      console.error('Failed to execute job:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to execute job';
      alert(errorMessage);
    } finally {
      setTimeout(() => {
        setExecuting(false);
        fetchJobDetails(); // Refresh data
      }, 2000);
    }
  };

  const deleteJob = async () => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/jobs/${id}`);
      navigate('/jobs');
    } catch (error: any) {
      console.error('Failed to delete job:', error);
      
      const errorMessage = error.response?.data?.error || 'Failed to delete job';
      alert(errorMessage);
    }
  };

  const openSwitchConsole = (switchConfig: any) => {
    setSelectedSwitch(switchConfig);
    setShowConsole(true);
  };

  const tabs = [
    { id: 'devices', label: 'Known Devices', icon: Users },
    { id: 'whitelist', label: 'Whitelist', icon: UserCheck },
    { id: 'history', label: 'Execution History', icon: History },
  ];

  // Get current job status from WebSocket
  const currentJobStatus = id ? jobStatuses.get(id) : null;
  const isJobRunning = currentJobStatus?.status === 'running' || executing;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">Job not found</h3>
        <p className="text-gray-500 mb-4">The requested job could not be found.</p>
        <Button onClick={() => navigate('/jobs')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/jobs')}
            className="border-gray-600 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                {job.name}
              </h1>
              {id && <JobStatusIndicator jobId={id} />}
            </div>
            <p className="text-gray-400 mt-1">
              VLAN {job.vlan_id} • {job.switches.length} switches • 
              {job.last_execution && (
                <span className="ml-1">
                  Last run {formatDistanceToNow(new Date(job.last_execution.execution_time))} ago
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${
            job.is_active 
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
          }`}>
            {job.is_active ? 'Active' : 'Inactive'}
          </div>
          
          <Button
            onClick={executeJob}
            disabled={executing || isJobRunning}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {executing || isJobRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowEditModal(true)}
            disabled={isJobRunning}
            className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <Button
            variant="outline"
            onClick={deleteJob}
            disabled={isJobRunning}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Real-time Job Status */}
      {currentJobStatus && currentJobStatus.status === 'running' && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold text-blue-400">Job Running</h3>
                <p className="text-sm text-blue-300">{currentJobStatus.message}</p>
                {currentJobStatus.currentSwitch && (
                  <p className="text-xs text-blue-200">Current switch: {currentJobStatus.currentSwitch}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400">{currentJobStatus.progress}%</div>
              <div className="w-32 h-2 bg-gray-700 rounded-full mt-1">
                <div 
                  className="h-full bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${currentJobStatus.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Completion Status */}
      {currentJobStatus && (currentJobStatus.status === 'completed' || currentJobStatus.status === 'failed') && (
        <div className={`border rounded-xl p-4 ${
          currentJobStatus.status === 'completed' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center space-x-3">
            {currentJobStatus.status === 'completed' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <div>
              <h3 className={`text-lg font-semibold ${
                currentJobStatus.status === 'completed' ? 'text-green-400' : 'text-red-400'
              }`}>
                Job {currentJobStatus.status === 'completed' ? 'Completed' : 'Failed'}
              </h3>
              <p className={`text-sm ${
                currentJobStatus.status === 'completed' ? 'text-green-300' : 'text-red-300'
              }`}>
                {currentJobStatus.message}
              </p>
              {currentJobStatus.status === 'completed' && (
                <div className="flex items-center space-x-4 mt-2 text-xs text-green-200">
                  {currentJobStatus.devicesFound !== undefined && (
                    <span>Devices found: {currentJobStatus.devicesFound}</span>
                  )}
                  {currentJobStatus.newDevices !== undefined && currentJobStatus.newDevices > 0 && (
                    <span>New: {currentJobStatus.newDevices}</span>
                  )}
                  {currentJobStatus.unauthorizedDevices !== undefined && currentJobStatus.unauthorizedDevices > 0 && (
                    <span>Unauthorized: {currentJobStatus.unauthorizedDevices}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Job Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-cyan-500/30 transition-colors">
          <div className="flex items-center space-x-3">
            <Server className="h-8 w-8 text-cyan-400" />
            <div>
              <p className="text-sm text-gray-400">Switches</p>
              <p className="text-2xl font-bold text-white">{job.switches.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-purple-500/30 transition-colors">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-sm text-gray-400">Devices</p>
              <p className="text-2xl font-bold text-white">{job.device_count}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-green-500/30 transition-colors">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Schedule</p>
              <p className="text-lg font-semibold text-white">
                {job.schedule_type === 'manual' ? 'Manual' : `${job.schedule_interval}min`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-blue-500/30 transition-colors">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Retention</p>
              <p className="text-lg font-semibold text-white">
                {job.retention_policy === '7days' ? '7 Days' : 
                 job.retention_policy === 'keep_forever' ? 'Forever' : 'Immediate'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Last Execution Status */}
      {job.last_execution && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Last Execution</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {job.last_execution.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <span className={`font-medium ${
                  job.last_execution.status === 'success' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {job.last_execution.status === 'success' ? 'Successful' : 'Failed'}
                </span>
              </div>
              <span className="text-gray-400">
                {formatDistanceToNow(new Date(job.last_execution.execution_time))} ago
              </span>
              <span className="text-gray-400">
                {job.last_execution.devices_found} devices found
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Switches List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Configured Switches</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {job.switches.map((switchConfig) => (
            <div key={switchConfig.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-cyan-500/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-white">{switchConfig.name}</h3>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openSwitchConsole(switchConfig)}
                    className="border-gray-500/30 text-gray-400 hover:text-white"
                  >
                    <Terminal className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-400">{switchConfig.host}:{switchConfig.port}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'devices' && <DevicesList jobId={job.id} />}
        {activeTab === 'whitelist' && <WhitelistManager jobId={job.id} />}
        {activeTab === 'history' && <JobHistory jobId={job.id} />}
      </div>

      {/* Modals */}
      {showEditModal && (
        <EditJobModal
          job={job}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false);
            fetchJobDetails();
          }}
        />
      )}

      {showConsole && selectedSwitch && (
        <SwitchConsole
          switchConfig={selectedSwitch}
          onClose={() => {
            setShowConsole(false);
            setSelectedSwitch(null);
          }}
        />
      )}
    </div>
  );
}