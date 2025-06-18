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

// Setup WebSocket server for real-time notifications
const wss = new WebSocketServer({ 
  server,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

wss.on('connection', (ws, req) => {
  console.log(`Client connected to WebSocket from ${req.socket.remoteAddress}`);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Attach WebSocket server to notification service
notificationService.setWebSocketServer(wss);

// Setup routes
setupRoutes(app, database, jobScheduler, notificationService);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
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
      console.log(`📡 WebSocket server ready for real-time notifications`);
      console.log(`🌐 API accessible from network at http://[YOUR_IP]:${PORT}/api`);
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