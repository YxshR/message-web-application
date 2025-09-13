const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { testConnection, gracefulShutdown } = require('./src/config/database');
require('dotenv').config();

// Import routes
const authRoutes = require('./src/routes/auth');
const contactRoutes = require('./src/routes/contacts');
const userRoutes = require('./src/routes/users');
const messageRoutes = require('./src/routes/messages');
const socketRoutes = require('./src/routes/socket');
const healthRoutes = require('./src/routes/health');
const monitoringRoutes = require('./src/routes/monitoring');

// Import Socket.IO manager
const { initializeSocket } = require('./src/socket/socketManager');

// Import error handling middleware
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import resource monitoring
const { 
  initializeResourceMonitor, 
  requestTrackingMiddleware, 
  connectionPoolMonitoringMiddleware 
} = require('./src/middleware/resourceMonitoring');
const { pool } = require('./src/config/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Initialize resource monitoring
const resourceMonitor = initializeResourceMonitor({
  metricsRetentionMs: 600000, // 10 minutes
  alertCooldownMs: 60000, // 1 minute
  alertThresholds: {
    maxActiveConnections: 18,
    maxQueuedRequests: 100,
    maxResponseTime: 5000,
    maxErrorRate: 0.05,
    minThroughput: 1
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Resource monitoring middleware
app.use(requestTrackingMiddleware);
app.use(connectionPoolMonitoringMiddleware(pool));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/socket', socketRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    data: { 
      message: 'Real-time Messaging API Server',
      version: '1.0.0',
      status: 'healthy'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true,
    data: { 
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// Initialize Socket.IO with authentication and handlers
initializeSocket(io);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Initialize server with database connection
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Server not started.');
      process.exit(1);
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Database connected successfully');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close HTTP server
    server.close(() => {
      console.log('HTTP server closed');
    });
    
    // Close Socket.IO server
    io.close(() => {
      console.log('Socket.IO server closed');
    });
    
    // Destroy resource monitor
    if (resourceMonitor) {
      resourceMonitor.destroy();
      console.log('Resource monitor destroyed');
    }
    
    // Close database connections
    const dbClosed = await gracefulShutdown();
    if (dbClosed) {
      console.log('Database connections closed');
    }
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  handleShutdown('unhandledRejection');
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };