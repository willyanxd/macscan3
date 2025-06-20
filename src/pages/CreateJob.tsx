import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, TestTube, ArrowLeft, Info, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';

interface SwitchConfig {
  name: string;
  host: string;
  community: string;
  version: string;
  tested: boolean;
  testResult?: any;
}

export function CreateJob() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    vlan_id: '',
    schedule_type: 'manual',
    schedule_interval: 60,
    retention_policy: '7days',
    notifications_enabled: true,
    warning_notifications: true,
  });
  const [switches, setSwitches] = useState<SwitchConfig[]>([]);

  const addSwitch = () => {
    setSwitches([...switches, {
      name: '',
      host: '',
      community: 'public',
      version: '2c',
      tested: false
    }]);
  };

  const removeSwitch = (index: number) => {
    setSwitches(switches.filter((_, i) => i !== index));
  };

  const updateSwitch = (index: number, field: keyof SwitchConfig, value: string) => {
    const updated = [...switches];
    updated[index] = { ...updated[index], [field]: value, tested: false };
    setSwitches(updated);
  };

  const testConnection = async (index: number) => {
    const switchConfig = switches[index];
    const updated = [...switches];
    
    try {
      updated[index] = { ...updated[index], tested: false };
      setSwitches(updated);

      const response = await api.post('/switches/test', {
        host: switchConfig.host,
        community: switchConfig.community,
        version: switchConfig.version
      });

      updated[index] = { 
        ...updated[index], 
        tested: true, 
        testResult: response.data 
      };
      setSwitches(updated);

    } catch (error) {
      updated[index] = { 
        ...updated[index], 
        tested: true, 
        testResult: { 
          success: false, 
          message: 'SNMP connection test failed',
          details: { error: 'NETWORK_ERROR' }
        } 
      };
      setSwitches(updated);
    }
  };

  const testMacScan = async (index: number) => {
    const switchConfig = switches[index];
    
    if (!formData.vlan_id) {
      alert('Please enter a VLAN ID first');
      return;
    }

    try {
      const response = await api.post('/switches/test-scan', {
        host: switchConfig.host,
        community: switchConfig.community,
        version: switchConfig.version,
        vlan_id: parseInt(formData.vlan_id)
      });

      if (response.data.success) {
        alert(`MAC scan successful! Found ${response.data.macCount} devices on VLAN ${formData.vlan_id}.`);
      } else {
        alert('MAC scan failed. Check VLAN ID and switch configuration.');
      }
    } catch (error: any) {
      alert(`MAC scan failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate that all switches have been tested successfully
      const untestedSwitches = switches.filter(s => !s.tested || !s.testResult?.success);
      if (untestedSwitches.length > 0) {
        alert('Please test all switch connections before creating the job.');
        setLoading(false);
        return;
      }

      const jobData = {
        ...formData,
        vlan_id: parseInt(formData.vlan_id),
        switches: switches.map(({ tested, testResult, ...s }) => s) // Remove test data
      };

      await api.post('/jobs', jobData);
      navigate('/jobs');
    } catch (error: any) {
      console.error('Failed to create job:', error);
      alert(`Failed to create job: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          onClick={() => navigate('/jobs')}
          className="border-gray-600 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Create New Job
          </h1>
          <p className="text-gray-400 mt-1">Configure a network scanning job with SNMP support</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Job Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter descriptive job name"
            />
            <Input
              label="VLAN ID"
              type="number"
              value={formData.vlan_id}
              onChange={(e) => setFormData({ ...formData, vlan_id: e.target.value })}
              required
              placeholder="Enter VLAN ID to scan"
            />
          </div>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-medium">Job Configuration Tips:</p>
                <ul className="mt-1 space-y-1 text-blue-200">
                  <li>• Choose a descriptive name that identifies the network segment</li>
                  <li>• VLAN ID must exist on all configured switches</li>
                  <li>• Test all switch SNMP connections before saving</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Schedule Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Schedule Type"
              value={formData.schedule_type}
              onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value })}
              options={[
                { value: 'manual', label: 'Manual Execution Only' },
                { value: 'interval', label: 'Automatic Interval' }
              ]}
            />
            {formData.schedule_type === 'interval' && (
              <Input
                label="Interval (minutes)"
                type="number"
                value={formData.schedule_interval}
                onChange={(e) => setFormData({ ...formData, schedule_interval: parseInt(e.target.value) })}
                min="5"
                placeholder="Minimum 5 minutes"
              />
            )}
          </div>
        </div>

        {/* Retention & Notifications */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Retention & Notifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Device Retention Policy"
              value={formData.retention_policy}
              onChange={(e) => setFormData({ ...formData, retention_policy: e.target.value })}
              options={[
                { value: '7days', label: '7 Days (Recommended)' },
                { value: 'keep_forever', label: 'Keep Forever' },
                { value: 'remove_immediately', label: 'Remove When Offline' }
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
                New Device Notifications
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
                Unauthorized Device Warnings
              </label>
            </div>
          </div>
        </div>

        {/* Enhanced Switches Configuration */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Switch Configuration (SNMP)</h2>
            <Button
              type="button"
              onClick={addSwitch}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Switch
            </Button>
          </div>

          <div className="space-y-6">
            {switches.map((switchConfig, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Switch {index + 1}</h3>
                  <div className="flex items-center space-x-2">
                    {switchConfig.tested && (
                      <div className="flex items-center space-x-1">
                        {switchConfig.testResult?.success ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => testConnection(index)}
                      disabled={!switchConfig.host || !switchConfig.community}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      <TestTube className="h-3 w-3 mr-1" />
                      Test SNMP
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => testMacScan(index)}
                      disabled={!switchConfig.tested || !switchConfig.testResult?.success || !formData.vlan_id}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      Test MAC Scan
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <Input
                    label="Switch Name"
                    value={switchConfig.name}
                    onChange={(e) => updateSwitch(index, 'name', e.target.value)}
                    placeholder="e.g., Core Switch 1"
                    required
                  />
                  <Input
                    label="Host/IP Address"
                    value={switchConfig.host}
                    onChange={(e) => updateSwitch(index, 'host', e.target.value)}
                    placeholder="192.168.1.1"
                    required
                  />
                  <Input
                    label="SNMP Community"
                    value={switchConfig.community}
                    onChange={(e) => updateSwitch(index, 'community', e.target.value)}
                    placeholder="public"
                    required
                  />
                  <Select
                    label="SNMP Version"
                    value={switchConfig.version}
                    onChange={(e) => updateSwitch(index, 'version', e.target.value)}
                    options={[
                      { value: '1', label: 'Version 1' },
                      { value: '2c', label: 'Version 2c' }
                    ]}
                  />
                </div>

                {/* Connection Test Results */}
                {switchConfig.tested && switchConfig.testResult && (
                  <div className={`p-3 rounded-lg border ${
                    switchConfig.testResult.success 
                      ? 'bg-green-500/10 border-green-500/20' 
                      : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {switchConfig.testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          switchConfig.testResult.success ? 'text-green-300' : 'text-red-300'
                        }`}>
                          {switchConfig.testResult.message}
                        </p>
                        {switchConfig.testResult.details && (
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            {switchConfig.testResult.details.connectionTime && (
                              <p>Connection time: {switchConfig.testResult.details.connectionTime}ms</p>
                            )}
                            {switchConfig.testResult.details.systemInfo && (
                              <p>System: {switchConfig.testResult.details.systemInfo.substring(0, 100)}...</p>
                            )}
                            {switchConfig.testResult.details.error && (
                              <p className="text-red-400">Error: {switchConfig.testResult.details.error}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {switches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Plus className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-400 mb-2">No switches configured</h3>
                <p className="text-gray-500">Add at least one switch to scan for MAC addresses via SNMP.</p>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/jobs')}
            className="border-gray-600 text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || switches.length === 0 || switches.some(s => !s.tested || !s.testResult?.success)}
            className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:opacity-50"
          >
            {loading ? 'Creating Job...' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  );
}