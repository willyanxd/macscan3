import React from 'react';
import { Shield, Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export function Header() {
  const { unreadCount } = useNotifications();

  return (
    <header className="bg-gray-800 border-b border-cyan-500/20 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              MAC Scanner
            </h1>
            <p className="text-sm text-gray-400">Network Security Monitor</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Bell className="h-6 w-6 text-gray-400 hover:text-cyan-400 cursor-pointer transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="h-8 w-8 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-white">A</span>
          </div>
        </div>
      </div>
    </header>
  );
}