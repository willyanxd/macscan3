import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { Database } from './database/database.js';
import { JobScheduler } from './services/jobScheduler.js';
import { NotificationService } from './services/notificationService.js';
import { setupRoutes } from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS configuration for network access
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize services
const database = new Database();
const notificationService = new NotificationService();
const jobScheduler = new JobScheduler(database, notificationService);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server for real-time notifications and job status
const wss = new WebSocketServer({ 
  server,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

wss.on('connection', (ws, req) => {
  console.log(`Client connected to WebSocket from ${req.socket.remoteAddress}`);
  
  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to MAC Scanner WebSocket',
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Handle ping/pong for connection health
  ws.on('ping', () => {
    ws.pong();
  });
});

// Attach WebSocket server and database to notification service
notificationService.setWebSocketServer(wss);
notificationService.setDatabase(database);

// Setup routes
setupRoutes(app, database, jobScheduler, notificationService);

// Health check endpoint with enhanced information
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    websocket_clients: wss.clients.size,
    running_jobs: jobScheduler.runningJobs?.size || 0
  });
});

// WebSocket health endpoint
app.get('/api/websocket/status', (req, res) => {
  res.json({
    connected_clients: wss.clients.size,
    server_status: 'running'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await database.initialize();
    console.log('✅ Database initialized successfully');
    
    await jobScheduler.initialize();
    console.log('✅ Job scheduler initialized successfully');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📡 WebSocket server ready for real-time updates`);
      console.log(`🌐 API accessible from network at http://[YOUR_IP]:${PORT}/api`);
      console.log(`🔧 Health check available at http://[YOUR_IP]:${PORT}/health`);
    });

    // Setup WebSocket heartbeat
    const interval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.ping();
          } catch (error) {
            console.error('WebSocket ping error:', error);
          }
        }
      });
    }, 30000); // 30 seconds

    // Cleanup interval on server shutdown
    process.on('SIGINT', () => {
      clearInterval(interval);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    await jobScheduler.shutdown();
    await database.close();
    
    // Close WebSocket connections
    wss.clients.forEach((ws) => {
      ws.close();
    });
    
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();