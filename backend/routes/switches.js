import { SNMPService } from '../services/snmpService.js';

const snmpService = new SNMPService();

export function switchRoutes(app, database) {
  // Enhanced switch connection test with SNMP
  app.post('/api/switches/test', async (req, res) => {
    try {
      const { host, community = 'public', version = '2c' } = req.body;

      if (!host || !community) {
        return res.status(400).json({ 
          error: 'Host and community are required',
          details: { host: !!host, community: !!community }
        });
      }

      console.log(`Testing SNMP connection to ${host} with community ${community}`);
      const result = await snmpService.testConnection({
        host,
        community,
        version
      });

      res.json(result);
    } catch (error) {
      console.error('Switch SNMP test failed:', error);
      res.json({ 
        success: false, 
        message: error.message,
        details: {
          error: error.code || 'UNKNOWN_ERROR',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    }
  });

  // Get switch information via SNMP
  app.post('/api/switches/info', async (req, res) => {
    try {
      const { host, community = 'public', version = '2c' } = req.body;

      if (!host || !community) {
        return res.status(400).json({ error: 'Host and community are required' });
      }

      const switchInfo = await snmpService.getSwitchInfo({
        host,
        community,
        version
      });

      res.json(switchInfo);
    } catch (error) {
      console.error('Failed to get switch info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test MAC scanning on a switch via SNMP
  app.post('/api/switches/test-scan', async (req, res) => {
    try {
      const { host, community = 'public', version = '2c', vlan_id } = req.body;

      if (!host || !community || !vlan_id) {
        return res.status(400).json({ 
          error: 'Host, community, and VLAN ID are required' 
        });
      }

      console.log(`Testing MAC scan on ${host} for VLAN ${vlan_id}`);
      const scanResult = await snmpService.testMacScan({
        host,
        community,
        version
      }, parseInt(vlan_id));

      res.json(scanResult);
    } catch (error) {
      console.error('MAC scan test failed:', error);
      res.status(500).json({ 
        error: error.message,
        details: {
          host: req.body.host,
          vlan_id: req.body.vlan_id
        }
      });
    }
  });

  // Get switches for a job
  app.get('/api/jobs/:jobId/switches', async (req, res) => {
    try {
      const { jobId } = req.params;

      const switches = await database.all('SELECT * FROM switches WHERE job_id = ?', [jobId]);
      res.json(switches);
    } catch (error) {
      console.error('Failed to fetch switches:', error);
      res.status(500).json({ error: 'Failed to fetch switches' });
    }
  });

  // Get switch status and basic info
  app.get('/api/switches/:id/status', async (req, res) => {
    try {
      const { id } = req.params;

      const switchConfig = await database.get('SELECT * FROM switches WHERE id = ?', [id]);
      if (!switchConfig) {
        return res.status(404).json({ error: 'Switch not found' });
      }

      // Test connection to get current status
      const connectionTest = await snmpService.testConnection({
        host: switchConfig.host,
        community: switchConfig.community,
        version: switchConfig.version || '2c'
      });

      res.json({
        switch: {
          name: switchConfig.name,
          host: switchConfig.host,
          community: switchConfig.community
        },
        status: connectionTest.success ? 'online' : 'offline',
        lastCheck: new Date().toISOString(),
        details: connectionTest.details
      });
    } catch (error) {
      console.error('Failed to get switch status:', error);
      res.status(500).json({ error: error.message });
    }
  });
}