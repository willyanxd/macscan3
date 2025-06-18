import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Send, Copy, Download, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';

interface SwitchConsoleProps {
  switchConfig: any;
  onClose: () => void;
}

export function SwitchConsole({ switchConfig, onClose }: SwitchConsoleProps) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new output is added
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    // Test connection on mount
    testConnection();
  }, []);

  const testConnection = async () => {
    setConnectionStatus('connecting');
    try {
      const response = await api.post('/switches/test', {
        host: switchConfig.host,
        port: switchConfig.port,
        username: switchConfig.username,
        password: switchConfig.password
      });

      if (response.data.success) {
        setConnectionStatus('connected');
        addOutput(`Connected to ${switchConfig.name} (${switchConfig.host})`);
        addOutput(`Connection time: ${response.data.details.connectionTime}ms`);
        if (response.data.details.sshVersion) {
          addOutput(`SSH Version: ${response.data.details.sshVersion}`);
        }
      } else {
        setConnectionStatus('disconnected');
        addOutput(`Connection failed: ${response.data.message}`);
        if (response.data.details.error) {
          addOutput(`Error: ${response.data.details.error}`);
        }
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      addOutput(`Connection error: ${error}`);
    }
  };

  const addOutput = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput(prev => [...prev, `[${timestamp}] ${text}`]);
  };

  const executeCommand = async () => {
    if (!command.trim() || connectionStatus !== 'connected') return;

    setLoading(true);
    const currentCommand = command;
    setCommand('');

    addOutput(`> ${currentCommand}`);

    try {
      const response = await api.post(`/switches/${switchConfig.id}/execute`, {
        command: currentCommand
      });

      if (response.data.success) {
        const lines = response.data.output.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            addOutput(line);
          }
        });
        addOutput(`Command completed in ${response.data.executionTime}ms`);
      } else {
        addOutput(`Command failed: ${response.data.output || 'Unknown error'}`);
      }
    } catch (error: any) {
      addOutput(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const copyOutput = () => {
    const text = output.join('\n');
    navigator.clipboard.writeText(text);
  };

  const downloadOutput = () => {
    const text = output.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${switchConfig.name}-console-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <Terminal className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                SSH Console - {switchConfig.name}
              </h2>
              <p className="text-sm text-gray-400">
                {switchConfig.host}:{switchConfig.port}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 
                connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
              }`}></div>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyOutput}
                className="border-gray-600 text-gray-400 hover:text-white"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadOutput}
                className="border-gray-600 text-gray-400 hover:text-white"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearOutput}
                className="border-gray-600 text-gray-400 hover:text-white"
              >
                Clear
              </Button>
              <Button variant="ghost" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Console Output */}
        <div 
          ref={outputRef}
          className="flex-1 p-4 bg-black/50 font-mono text-sm text-green-400 overflow-y-auto"
        >
          {output.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Console ready. Enter commands below.</p>
              {connectionStatus === 'disconnected' && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center justify-center space-x-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>Connection failed. Check switch credentials and network connectivity.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {output.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={connectionStatus === 'connected' ? 'Enter command...' : 'Connect to switch first'}
                disabled={connectionStatus !== 'connected' || loading}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono disabled:opacity-50"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
                </div>
              )}
            </div>
            <Button
              onClick={executeCommand}
              disabled={!command.trim() || connectionStatus !== 'connected' || loading}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to execute command. Common commands: show version, show mac address-table, show interfaces
          </div>
        </div>
      </div>
    </div>
  );
}