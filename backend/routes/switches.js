import { SSHService } from '../services/sshService.js';

const sshService = new SSHService();

export function switchRoutes(app, database) {
  // Enhanced switch connection test with detailed debugging
  app.post('/api/switches/test', async (req, res) => {
    try {
      const { host, port = 22, username, password } = req.body;

      if (!host || !username || !password) {
        return res.status(400).json({ 
          error: 'Host, username, and password are required',
          details: { host: !!host, username: !!username, password: !!password }
        });
      }

      console.log(`Testing connection to ${host}:${port} with user ${username}`);
      const result = await sshService.testConnection({
        host,
        port: parseInt(port),
        username,
        password
      });

      res.json(result);
    } catch (error) {
      console.error('Switch connection test failed:', error);
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

  // Get switch information and capabilities
  app.post('/api/switches/info', async (req, res) => {
    try {
      const { host, port = 22, username, password } = req.body;

      if (!host || !username || !password) {
        return res.status(400).json({ error: 'Host, username, and password are required' });
      }

      const switchInfo = await sshService.getSwitchInfo({
        host,
        port: parseInt(port),
        username,
        password
      });

      res.json(switchInfo);
    } catch (error) {
      console.error('Failed to get switch info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Execute command on switch with enhanced debugging
  app.post('/api/switches/:id/execute', async (req, res) => {
    try {
      const { id } = req.params;
      const { command } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const switchConfig = await database.get('SELECT * FROM switches WHERE id = ?', [id]);
      if (!switchConfig) {
        return res.status(404).json({ error: 'Switch not found' });
      }

      console.log(`Executing command on switch ${switchConfig.name}: ${command}`);
      const result = await sshService.executeCommand(switchConfig, command);
      res.json(result);
    } catch (error) {
      console.error('Command execution failed:', error);
      res.status(500).json({ 
        error: error.message,
        details: {
          command: req.body.command,
          switchId: req.params.id
        }
      });
    }
  });

  // Test MAC scanning on a switch
  app.post('/api/switches/test-scan', async (req, res) => {
    try {
      const { host, port = 22, username, password, vlan_id } = req.body;

      if (!host || !username || !password || !vlan_id) {
        return res.status(400).json({ 
          error: 'Host, username, password, and VLAN ID are required' 
        });
      }

      console.log(`Testing MAC scan on ${host} for VLAN ${vlan_id}`);
      const scanResult = await sshService.scanMacAddresses({
        host,
        port: parseInt(port),
        username,
        password
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

  // Create interactive SSH shell
  app.post('/api/switches/:id/shell', async (req, res) => {
    try {
      const { id } = req.params;

      const switchConfig = await database.get('SELECT * FROM switches WHERE id = ?', [id]);
      if (!switchConfig) {
        return res.status(404).json({ error: 'Switch not found' });
      }

      // For now, return connection details for frontend to handle
      res.json({
        message: 'Shell connection details',
        switch: {
          name: switchConfig.name,
          host: switchConfig.host,
          port: switchConfig.port
        }
      });
    } catch (error) {
      console.error('Failed to create shell:', error);
      res.status(500).json({ error: error.message });
    }
  });
}