import { v4 as uuidv4 } from 'uuid';

export function deviceRoutes(app, database) {
  // Get devices for a job
  app.get('/api/jobs/:jobId/devices', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { limit = 100, offset = 0, status, authorized } = req.query;

      let query = `
        SELECT kd.*, s.name as switch_name, s.host as switch_host
        FROM known_devices kd
        LEFT JOIN switches s ON kd.switch_id = s.id
        WHERE kd.job_id = ?
      `;
      const params = [jobId];

      if (status) {
        query += ' AND kd.status = ?';
        params.push(status);
      }

      if (authorized !== undefined) {
        query += ' AND kd.is_authorized = ?';
        params.push(authorized === 'true' ? 1 : 0);
      }

      query += ' ORDER BY kd.last_seen DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const devices = await database.all(query, params);
      res.json(devices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  // Update device authorization
  app.put('/api/devices/:id/authorize', async (req, res) => {
    try {
      const { id } = req.params;
      const { authorized, device_name } = req.body;

      await database.run(
        'UPDATE known_devices SET is_authorized = ?, device_name = ? WHERE id = ?',
        [authorized ? 1 : 0, device_name || null, id]
      );

      // If authorizing, add to whitelist
      if (authorized) {
        const device = await database.get('SELECT * FROM known_devices WHERE id = ?', [id]);
        if (device) {
          const whitelistId = uuidv4();
          await database.run(
            'INSERT OR REPLACE INTO whitelist (id, job_id, mac_address, device_name) VALUES (?, ?, ?, ?)',
            [whitelistId, device.job_id, device.mac_address, device_name || null]
          );
        }
      }

      res.json({ message: 'Device authorization updated' });
    } catch (error) {
      console.error('Failed to update device authorization:', error);
      res.status(500).json({ error: 'Failed to update device authorization' });
    }
  });

  // Delete device
  app.delete('/api/devices/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const device = await database.get('SELECT * FROM known_devices WHERE id = ?', [id]);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      await database.run('DELETE FROM known_devices WHERE id = ?', [id]);
      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Failed to delete device:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  });

  // Get whitelist for a job
  app.get('/api/jobs/:jobId/whitelist', async (req, res) => {
    try {
      const { jobId } = req.params;

      const whitelist = await database.all(
        'SELECT * FROM whitelist WHERE job_id = ? ORDER BY added_at DESC',
        [jobId]
      );

      res.json(whitelist);
    } catch (error) {
      console.error('Failed to fetch whitelist:', error);
      res.status(500).json({ error: 'Failed to fetch whitelist' });
    }
  });

  // Add to whitelist
  app.post('/api/jobs/:jobId/whitelist', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { mac_address, device_name } = req.body;

      if (!mac_address) {
        return res.status(400).json({ error: 'MAC address is required' });
      }

      const whitelistId = uuidv4();
      await database.run(
        'INSERT OR REPLACE INTO whitelist (id, job_id, mac_address, device_name) VALUES (?, ?, ?, ?)',
        [whitelistId, jobId, mac_address, device_name || null]
      );

      // Update existing devices
      await database.run(
        'UPDATE known_devices SET is_authorized = 1, device_name = ? WHERE job_id = ? AND mac_address = ?',
        [device_name || null, jobId, mac_address]
      );

      res.status(201).json({ message: 'Device added to whitelist' });
    } catch (error) {
      console.error('Failed to add to whitelist:', error);
      res.status(500).json({ error: 'Failed to add to whitelist' });
    }
  });

  // Remove from whitelist
  app.delete('/api/whitelist/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const whitelistEntry = await database.get('SELECT * FROM whitelist WHERE id = ?', [id]);
      if (!whitelistEntry) {
        return res.status(404).json({ error: 'Whitelist entry not found' });
      }

      await database.run('DELETE FROM whitelist WHERE id = ?', [id]);

      // Update corresponding devices
      await database.run(
        'UPDATE known_devices SET is_authorized = 0 WHERE job_id = ? AND mac_address = ?',
        [whitelistEntry.job_id, whitelistEntry.mac_address]
      );

      res.json({ message: 'Device removed from whitelist' });
    } catch (error) {
      console.error('Failed to remove from whitelist:', error);
      res.status(500).json({ error: 'Failed to remove from whitelist' });
    }
  });
}