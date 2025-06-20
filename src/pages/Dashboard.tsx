import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Shield, 
  AlertTriangle, 
  Clock,
  Users,
  Server,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { StatsCard } from '../components/StatsCard';
import { RecentActivity } from '../components/RecentActivity';
import { ActiveJobs } from '../components/ActiveJobs';
import { Button } from '../components/Button';
import { useWebSocket } from '../contexts/WebSocketContext';

interface DashboardStats {
  total_jobs: number;
  active_jobs: number;
  total_devices: number;
  unauthorized_devices: number;
  unread_notifications: number;
  recent_warnings: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isConnected, jobStatuses } = useWebSocket();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Refresh stats when job statuses change
  useEffect(() => {
    if (jobStatuses.size > 0) {
      // Check if any job completed
      const completedJobs = Array.from(jobStatuses.values()).filter(
        status => status.status === 'completed' || status.status === 'failed'
      );
      
      if (completedJobs.length > 0) {
        // Refresh stats after a short delay to allow database updates
        setTimeout(() => {
          fetchDashboardStats();
        }, 2000);
      }
    }
  }, [jobStatuses]);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Network security monitoring overview</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Refresh Button */}
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="border-gray-600 text-gray-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {/* Last Updated */}
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Clock className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Jobs"
          value={stats?.total_jobs || 0}
          icon={Server}
          color="cyan"
          loading={loading}
        />
        <StatsCard
          title="Active Jobs"
          value={stats?.active_jobs || 0}
          icon={Activity}
          color="green"
          loading={loading}
        />
        <StatsCard
          title="Total Devices"
          value={stats?.total_devices || 0}
          icon={Users}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title="Unauthorized"
          value={stats?.unauthorized_devices || 0}
          icon={AlertTriangle}
          color="red"
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div>
          <ActiveJobs />
        </div>

        {/* Recent Activity */}
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}