import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Activity,
  Zap
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/jobs', label: 'Jobs', icon: Settings },
  { path: '/notifications', label: 'Notifications', icon: Bell },
];

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="fixed left-0 top-16 h-full w-64 bg-gray-800 border-r border-cyan-500/20 p-4">
      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'} transition-colors`} />
              <span className="font-medium">{item.label}</span>
              {isActive && (
                <div className="ml-auto">
                  <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg p-4 border border-cyan-500/20">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-400">System Status</span>
          </div>
          <div className="text-xs text-gray-400">
            <div className="flex justify-between">
              <span>Active Jobs:</span>
              <span className="text-green-400">Running</span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="text-green-400">Connected</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}