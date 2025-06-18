import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Shield, 
  AlertTriangle, 
  Bell,
  TrendingUp,
  Clock,
  Users,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { StatsCard } from '../components/StatsCard';
import { RecentActivity } from '../components/RecentActivity';
import { ActiveJobs } from '../components/ActiveJobs';
import { RecentNotifications } from '../components/RecentNotifications';

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

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
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
            Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Network security monitoring overview</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Jobs"
          value={stats?.total_jobs || 0}
          icon={Server}
          color="cyan"
          trend="+12%"
        />
        <StatsCard
          title="Active Jobs"
          value={stats?.active_jobs || 0}
          icon={Activity}
          color="green"
          trend="+5%"
        />
        <StatsCard
          title="Total Devices"
          value={stats?.total_devices || 0}
          icon={Users}
          color="blue"
          trend="+23%"
        />
        <StatsCard
          title="Unauthorized"
          value={stats?.unauthorized_devices || 0}
          icon={AlertTriangle}
          color="red"
          trend="-8%"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Jobs */}
        <div className="lg:col-span-2">
          <ActiveJobs />
        </div>

        {/* Recent Notifications */}
        <div>
          <RecentNotifications />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <RecentActivity />
      </div>
    </div>
  );
}