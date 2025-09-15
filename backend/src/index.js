const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const compression = require('compression');
const { initializeDatabase, setupDatabaseShutdown } = require('./utils/initDatabase');
const SocketService = require('./services/socketService');
const {
  configureCors,
  configureRateLimit,
  configureAuthRateLimit,
  configureHelmet,
  configureTrustProxy
} = require('./middleware/security');
const { configureLogging } = require('./middleware/logging');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const socketService = new SocketService();
const PORT = process.env.PORT || 5000;

// Configure trust proxy
configureTrustProxy(app);

// Security middleware
app.use(configureHelmet());
app.use(configureCors());
app.use(configureRateLimit());

// Logging middleware
app.use(configureLogging());

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const chatRoutes = require('./routes/chats');
const dashboardRoutes = require('./routes/dashboard');
const friendRequestRoutes = require('./routes/friendRequests');

// Apply stricter rate limiting to auth routes
app.use('/api/auth', configureAuthRateLimit());
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/friend-requests', friendRequestRoutes);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Real-time chat backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database health check route
app.get('/health/db', async (req, res) => {
  try {
    const { testDatabaseConnection, getConnectionPoolStatus } = require('./utils/database');
    const isConnected = await testDatabaseConnection();

    if (isConnected) {
      const poolStatus = await getConnectionPoolStatus();
      res.json({
        status: 'OK',
        message: 'Database connection is healthy',
        timestamp: new Date().toISOString(),
        pool: poolStatus
      });
    } else {
      res.status(503).json({
        status: 'ERROR',
        message: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Database connection error',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global error handler
const { logError } = require('./middleware/logging');
app.use((error, req, res, next) => {
  logError(error, req);

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(error.status || 500).json({
    success: false,
    error: {
      message: isProduction ? 'Internal server error' : error.message,
      ...(isProduction ? {} : { stack: error.stack })
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      path: req.originalUrl
    },
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();

    // Initialize Socket.IO
    socketService.initialize(server);

    // Setup graceful shutdown handlers
    setupDatabaseShutdown();

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🗄️  Database health: http://localhost:${PORT}/health/db`);
      console.log(`🔌 Socket.IO ready for connections`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = { app, server, socketService };