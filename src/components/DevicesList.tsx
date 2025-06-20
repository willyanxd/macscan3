import React, { useEffect, useState } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Trash2, 
  Edit,
  Wifi,
  WifiOff,
  Filter,
  Search,
  Download,
  UserPlus,
  Network,
  Building2
} from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';
import { formatDistanceToNow } from 'date-fns';

interface Device {
  id: string;
  mac_address: string;
  switch_name: string;
  switch_host: string;
  vlan_id: number;
  interface_name: string | null;
  bridge_port: number | null;
  if_index: number | null;
  vendor: string | null;
  is_authorized: boolean;
  first_seen: string;
  last_seen: string;
  status: 'online' | 'offline';
  device_name: string | null;
}

interface DevicesListProps {
  jobId: string;
}

export function DevicesList({ jobId }: DevicesListProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'authorized' | 'unauthorized' | 'online' | 'offline'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchDevices();
  }, [jobId, filter]);

  const fetchDevices = async () => {
    try {
      const params: any = {};
      if (filter === 'authorized') params.authorized = 'true';
      if (filter === 'unauthorized') params.authorized = 'false';
      if (filter === 'online' || filter === 'offline') params.status = filter;

      const response = await api.get(`/jobs/${jobId}/devices`, { params });
      setDevices(response.data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthorization = async (deviceId: string, currentStatus: boolean, deviceName?: string) => {
    try {
      await api.put(`/devices/${deviceId}/authorize`, {
        authorized: !currentStatus,
        device_name: deviceName
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to update device authorization:', error);
    }
  };

  const updateDeviceName = async (deviceId: string, newName: string) => {
    try {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return;

      await api.put(`/devices/${deviceId}/authorize`, {
        authorized: device.is_authorized,
        device_name: newName
      });
      
      setEditingDevice(null);
      setEditName('');
      fetchDevices();
    } catch (error) {
      console.error('Failed to update device name:', error);
    }
  };

  const deleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      await api.delete(`/devices/${deviceId}`);
      setDevices(devices.filter(device => device.id !== deviceId));
    } catch (error) {
      console.error('Failed to delete device:', error);
    }
  };

  const addToWhitelist = async (device: Device) => {
    try {
      await api.post(`/jobs/${jobId}/whitelist`, {
        mac_address: device.mac_address,
        device_name: device.device_name
      });
      fetchDevices();
    } catch (error) {
      console.error('Failed to add to whitelist:', error);
    }
  };

  const exportDevices = () => {
    const csvContent = [
      'MAC Address,Device Name,Vendor,Switch,Interface,Status,Authorization,First Seen,Last Seen',
      ...filteredDevices.map(device => 
        `${device.mac_address},${device.device_name || ''},${device.vendor || ''},${device.switch_name},${device.interface_name || ''},${device.status},${device.is_authorized ? 'Authorized' : 'Unauthorized'},${device.first_seen},${device.last_seen}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices-${jobId}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredDevices = devices.filter(device =>
    device.mac_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.device_name && device.device_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (device.vendor && device.vendor.toLowerCase().includes(searchTerm.toLowerCase())) ||
    device.switch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.interface_name && device.interface_name.toLowerCase().includes(searchTerm.toLowerCase()))
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
      {/* Enhanced Filters and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            {['all', 'authorized', 'unauthorized', 'online', 'offline'].map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption as any)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === filterOption
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {filterOption}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={exportDevices}
          variant="outline"
          className="border-gray-600 text-gray-400 hover:text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Enhanced Devices Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Switch & Interface
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Authorization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center space-x-2">
                        {editingDevice === device.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => updateDeviceName(device.id, editName)}
                            onKeyPress={(e) => e.key === 'Enter' && updateDeviceName(device.id, editName)}
                            className="text-sm font-medium bg-gray-600 text-white px-2 py-1 rounded border border-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-sm font-medium text-white cursor-pointer hover:text-cyan-400"
                            onClick={() => {
                              setEditingDevice(device.id);
                              setEditName(device.device_name || '');
                            }}
                          >
                            {device.device_name || 'Unknown Device'}
                          </span>
                        )}
                        <Edit className="h-3 w-3 text-gray-500" />
                      </div>
                      <div className="text-sm text-gray-400 font-mono">
                        {device.mac_address}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-purple-400" />
                      <span className="text-sm text-gray-300">
                        {device.vendor || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm text-white">{device.switch_name}</div>
                      <div className="text-sm text-gray-400">{device.switch_host}</div>
                      {device.interface_name && (
                        <div className="flex items-center space-x-1 text-xs text-cyan-400 mt-1">
                          <Network className="h-3 w-3" />
                          <span>{device.interface_name}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {device.status === 'online' ? (
                        <Wifi className="h-4 w-4 text-green-400" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                        device.status === 'online' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {device.status}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {device.is_authorized ? (
                        <ShieldCheck className="h-4 w-4 text-green-400" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-red-400" />
                      )}
                      <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                        device.is_authorized 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {device.is_authorized ? 'Authorized' : 'Unauthorized'}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatDistanceToNow(new Date(device.last_seen))} ago
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {!device.is_authorized && (
                        <Button
                          size="sm"
                          onClick={() => addToWhitelist(device)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Whitelist
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => toggleAuthorization(device.id, device.is_authorized, device.device_name)}
                        className={device.is_authorized 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-green-600 hover:bg-green-700'
                        }
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {device.is_authorized ? 'Revoke' : 'Authorize'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteDevice(device.id)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredDevices.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {searchTerm ? 'No matching devices' : 'No devices found'}
          </h3>
          <p className="text-gray-500">
            {searchTerm 
              ? 'Try adjusting your search terms or filters.'
              : filter === 'all' 
                ? 'No devices have been discovered yet. Run a job scan to find devices.'
                : `No ${filter} devices found.`
            }
          </p>
        </div>
      )}
    </div>
  );
}