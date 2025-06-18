import { jobRoutes } from './jobs.js';
import { switchRoutes } from './switches.js';
import { deviceRoutes } from './devices.js';
import { notificationRoutes } from './notifications.js';
import { dashboardRoutes } from './dashboard.js';

export function setupRoutes(app, database, jobScheduler, notificationService) {
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Setup route modules
  jobRoutes(app, database, jobScheduler);
  switchRoutes(app, database);
  deviceRoutes(app, database);
  notificationRoutes(app, database, notificationService);
  dashboardRoutes(app, database);

  // 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });
}