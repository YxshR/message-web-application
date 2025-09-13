const express = require('express');
const { getPoolHealth, testConnection } = require('../config/database');
const router = express.Router();

/**
 * @route GET /api/health
 * @desc Get application health status including database connection pool
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connectivity
    const dbConnected = await testConnection();
    const dbResponseTime = Date.now() - startTime;
    
    // Get detailed pool health
    const poolHealth = getPoolHealth();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: dbConnected,
        responseTime: dbResponseTime,
        pool: poolHealth
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    
    // Determine overall health status
    if (!dbConnected) {
      health.status = 'unhealthy';
      health.issues = ['Database connection failed'];
    } else if (poolHealth.status === 'critical') {
      health.status = 'critical';
      health.issues = [poolHealth.error || 'Database pool in critical state'];
    } else if (poolHealth.status === 'unhealthy') {
      health.status = 'degraded';
      health.issues = [poolHealth.error || 'Database pool unhealthy'];
    } else if (poolHealth.status === 'degraded') {
      health.status = 'degraded';
      health.issues = [poolHealth.warning || 'Database pool degraded'];
    }
    
    // Set appropriate HTTP status code
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * @route GET /api/health/database
 * @desc Get detailed database health information
 * @access Public
 */
router.get('/database', async (req, res) => {
  try {
    const poolHealth = getPoolHealth();
    const dbConnected = await testConnection();
    
    const databaseHealth = {
      connected: dbConnected,
      pool: poolHealth,
      timestamp: new Date().toISOString()
    };
    
    const statusCode = poolHealth.status === 'healthy' ? 200 : 
                      poolHealth.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(databaseHealth);
  } catch (error) {
    console.error('Database health check failed:', error);
    
    res.status(503).json({
      connected: false,
      error: 'Database health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/health/ready
 * @desc Readiness probe for container orchestration
 * @access Public
 */
router.get('/ready', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const poolHealth = getPoolHealth();
    
    if (dbConnected && poolHealth.status !== 'critical') {
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        ready: false,
        reason: !dbConnected ? 'Database not connected' : 'Database pool critical',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      ready: false,
      reason: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/health/live
 * @desc Liveness probe for container orchestration
 * @access Public
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if the server can respond, it's alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;