import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'cyan' | 'green' | 'blue' | 'red' | 'purple' | 'yellow';
  loading?: boolean;
}

export function StatsCard({ title, value, icon: Icon, color, loading = false }: StatsCardProps) {
  const colorClasses = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    green: 'text-green-400 bg-green-500/10 border-green-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-8 bg-gray-700 rounded w-1/2"></div>
          </div>
          <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-gray-600 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}