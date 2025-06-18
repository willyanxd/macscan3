import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Shield, 
  UserCheck,
  Search,
  Download,
  Upload
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';
import { formatDistanceToNow } from 'date-fns';

interface WhitelistEntry {
  id: string;
  mac_address: string;
  device_name: string | null;
  added_at: string;
}

interface WhitelistManagerProps {
  jobId: string;
}

export function WhitelistManager({ jobId }: WhitelistManagerProps) {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEntry, setNewEntry] = useState({
    mac_address: '',
    device_name: ''
  });

  useEffect(() => {
    fetchWhitelist();
  }, [jobId]);

  const fetchWhitelist = async () => {
    try {
      const response = await api.get(`/jobs/${jobId}/whitelist`);
      setWhitelist(response.data);
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWhitelist = async () => {
    if (!newEntry.mac_address) return;

    try {
      await api.post(`/jobs/${jobId}/whitelist`, newEntry);
      setNewEntry({ mac_address: '', device_name: '' });
      setShowAddForm(false);
      fetchWhitelist();
    } catch (error) {
      console.error('Failed to add to whitelist:', error);
    }
  };

  const removeFromWhitelist = async (entryId: string) => {
    if (!confirm('Are you sure you want to remove this device from the whitelist?')) {
      return;
    }

    try {
      await api.delete(`/jobs/${jobId}/whitelist/${entryId}`);
      setWhitelist(whitelist.filter(entry => entry.id !== entryId));
    } catch (error) {
      console.error('Failed to remove from whitelist:', error);
    }
  };

  const exportWhitelist = () => {
    const csvContent = [
      'MAC Address,Device Name,Added Date',
      ...whitelist.map(entry => 
        `${entry.mac_address},${entry.device_name || ''},${entry.added_at}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whitelist-${jobId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredWhitelist = whitelist.filter(entry =>
    entry.mac_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.device_name && entry.device_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search whitelist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={exportWhitelist}
            className="border-gray-600 text-gray-400 hover:text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Add Device to Whitelist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="MAC Address"
              value={newEntry.mac_address}
              onChange={(e) => setNewEntry({ ...newEntry, mac_address: e.target.value })}
              placeholder="xx:xx:xx:xx:xx:xx"
              required
            />
            <Input
              label="Device Name (Optional)"
              value={newEntry.device_name}
              onChange={(e) => setNewEntry({ ...newEntry, device_name: e.target.value })}
              placeholder="Enter device name"
            />
          </div>
          <div className="flex items-center justify-end space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewEntry({ mac_address: '', device_name: '' });
              }}
              className="border-gray-600 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={addToWhitelist}
              disabled={!newEntry.mac_address}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Add to Whitelist
            </Button>
          </div>
        </div>
      )}

      {/* Whitelist Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  MAC Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Added
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredWhitelist.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <UserCheck className="h-5 w-5 text-green-400" />
                      <div>
                        <div className="text-sm font-medium text-white">
                          {entry.device_name || 'Unknown Device'}
                        </div>
                        <div className="text-xs text-gray-400">Authorized</div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-300">
                      {entry.mac_address}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDistanceToNow(new Date(entry.added_at))} ago
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFromWhitelist(entry.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredWhitelist.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {searchTerm ? 'No matching devices' : 'No whitelisted devices'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms.'
              : 'Add devices to the whitelist to automatically authorize them.'
            }
          </p>
          {!searchTerm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Device
            </Button>
          )}
        </div>
      )}
    </div>
  );
}