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
    </nav>
  );
}