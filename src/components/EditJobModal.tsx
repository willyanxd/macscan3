import React, { useState, useEffect } from 'react';
import { X, TestTube, Trash2, Plus } from 'lucide-react';
import { api } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';

interface EditJobModalProps {
  job: any;
  onClose: () => void;
  onSave: () => void;
}

interface SwitchConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export function EditJobModal({ job, onClose, onSave }: EditJobModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: job.name,
    vlan_id: job.vlan_id,
    schedule_type: job.schedule_type,
    schedule_interval: job.schedule_interval,
    retention_policy: job.retention_policy,
    notifications_enabled: job.notifications_enabled,
    warning_notifications: job.warning_notifications,
  });
  const [switches, setSwitches] = useState<SwitchConfig[]>([]);

  useEffect(() => {
    // Load existing switches
    if (job.switches) {
      setSwitches(job.switches.map((s: any) => ({
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username || '',
        password: '' // Don't pre-fill password for security
      })));
    }
  }, [job]);

  const addSwitch = () => {
    setSwitches([...switches, {
      name: '',
      host: '',
      port: 22,
      username: '',
      password: ''
    }]);
  };

  const removeSwitch = (index: number) => {
    setSwitches(switches.filter((_, i) => i !== index));
  };

  const updateSwitch = (index: number, field: keyof SwitchConfig, value: string | number) => {
    const updated = [...switches];
    updated[index] = { ...updated[index], [field]: value };
    setSwitches(updated);
  };

  const testConnection = async (index: number) => {
    const switchConfig = switches[index];
    try {
      const response = await api.post('/switches/test', switchConfig);
      if (response.data.success) {
        alert('Connection successful!');
      } else {
        alert(`Connection failed: ${response.data.message}`);
      }
    } catch (error) {
      alert('Connection test failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const jobData = {
        ...formData,
        switches
      };

      await api.put(`/jobs/${job.id}`, jobData);
      onSave();
    } catch (error) {
      console.error('Failed to update job:', error);
      alert('Failed to update job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Edit Job</h2>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Job Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="VLAN ID"
                type="number"
                value={formData.vlan_id}
                onChange={(e) => setFormData({ ...formData, vlan_id: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          {/* Schedule Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Schedule Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Schedule Type"
                value={formData.schedule_type}
                onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'interval', label: 'Interval' }
                ]}
              />
              {formData.schedule_type === 'interval' && (
                <Input
                  label="Interval (minutes)"
                  type="number"
                  value={formData.schedule_interval}
                  onChange={(e) => setFormData({ ...formData, schedule_interval: parseInt(e.target.value) })}
                  min="1"
                />
              )}
            </div>
          </div>

          {/* Retention & Notifications */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Retention & Notifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Retention Policy"
                value={formData.retention_policy}
                onChange={(e) => setFormData({ ...formData, retention_policy: e.target.value })}
                options={[
                  { value: '7days', label: '7 Days' },
                  { value: 'keep_forever', label: 'Keep Forever' },
                  { value: 'remove_immediately', label: 'Remove Immediately' }
                ]}
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="notifications"
                  checked={formData.notifications_enabled}
                  onChange={(e) => setFormData({ ...formData, notifications_enabled: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="notifications" className="text-sm text-gray-300">
                  Enable Notifications
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="warnings"
                  checked={formData.warning_notifications}
                  onChange={(e) => setFormData({ ...formData, warning_notifications: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-700 text-red-500 focus:ring-red-500"
                />
                <label htmlFor="warnings" className="text-sm text-gray-300">
                  Warning Notifications
                </label>
              </div>
            </div>
          </div>

          {/* Switches Configuration */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Switches</h3>
              <Button
                type="button"
                onClick={addSwitch}
                className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Switch
              </Button>
            </div>

            <div className="space-y-4">
              {switches.map((switchConfig, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-medium text-white">Switch {index + 1}</h4>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => testConnection(index)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <TestTube className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => removeSwitch(index)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input
                      label="Switch Name"
                      value={switchConfig.name}
                      onChange={(e) => updateSwitch(index, 'name', e.target.value)}
                      required
                    />
                    <Input
                      label="Host/IP"
                      value={switchConfig.host}
                      onChange={(e) => updateSwitch(index, 'host', e.target.value)}
                      required
                    />
                    <Input
                      label="Port"
                      type="number"
                      value={switchConfig.port}
                      onChange={(e) => updateSwitch(index, 'port', parseInt(e.target.value))}
                    />
                    <Input
                      label="Username"
                      value={switchConfig.username}
                      onChange={(e) => updateSwitch(index, 'username', e.target.value)}
                      required
                    />
                    <Input
                      label="Password"
                      type="password"
                      value={switchConfig.password}
                      onChange={(e) => updateSwitch(index, 'password', e.target.value)}
                      placeholder="Enter new password or leave blank to keep current"
                    />
                  </div>
                </div>
              ))}
            </div>

            {switches.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No switches configured. Add at least one switch to continue.
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || switches.length === 0}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}