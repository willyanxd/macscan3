import React from 'react';
import { Shield } from 'lucide-react';

export function Header() {
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
      </div>
    </header>
  );
}