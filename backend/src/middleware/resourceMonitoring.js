const ResourceMonitor = require('../utils/resourceMonitor');

// Global resource monitor instance
let resourceMonitor = null;

/**
 * Reset the global monitor (for testing purposes)
 */
function resetResourceMonitor() {
  if (resourceMonitor) {
    resourceMonitor.destroy();
    resourceMonitor = null;
  }
}

/**
 * Initialize the resource monitor with configuration
 * @param {Object} options - Configuration options for the monitor
 * @returns {ResourceMonitor} The initialized monitor instance
 */
function initializeResourceMonitor(options = {}) {
  if (resourceMonitor) {
    console.warn('[ResourceMonitoring] Monitor already initialized');
    return resourceMonitor;
  }
  
  resourceMonitor = new ResourceMonitor(options);
  
  // Set up default alert handlers
  resourceMonitor.onAlert((alert) => {
    console.error(`[ALERT] ${alert.severity}: ${alert.message}`, {
      type: alert.type,
      timestamp: new Date(alert.timestamp).toISOString(),
      data: alert
    });
    
    // In production, you might want to send alerts to external monitoring systems
    // Example: sendToSlack(alert), sendToDatadog(alert), etc.
  });
  
  console.log('[ResourceMonitoring] Resource monitor initialized');
  return resourceMonitor;
}

/**
 * Get the global resource monitor instance
 * @returns {ResourceMonitor|null} The monitor instance or null if not initialized
 */
function getResourceMonitor() {
  return resourceMonitor;
}

/**
 * Express middleware to track request performance and resource usage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestTrackingMiddleware(req, res, next) {
  if (!resourceMonitor) {
    return next();
  }
  
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  // Track the original end method
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // Track the request
    resourceMonitor.trackRequest(endpoint, duration, success, {
      statusCode: res.statusCode,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Call the original end method
    originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Middleware to monitor database connection pool usage
 * This should be called after database operations to update pool metrics
 * @param {Object} pool - Database connection pool instance
 * @returns {Function} Middleware function
 */
function connectionPoolMonitoringMiddleware(pool) {
  return (req, res, next) => {
    if (!resourceMonitor || !pool) {
      return next();
    }
    
    // Update connection pool metrics
    const poolStats = {
      active: pool.numUsed ? pool.numUsed() : 0,
      idle: pool.numFree ? pool.numFree() : 0,
      total: pool.numUsed && pool.numFree ? pool.numUsed() + pool.numFree() : 0,
      queued: pool.numPendingAcquires ? pool.numPendingAcquires() : 0
    };
    
    resourceMonitor.updateConnectionPoolMetrics(poolStats);
    next();
  };
}

/**
 * Express route handler to expose monitoring metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function metricsEndpoint(req, res) {
  if (!resourceMonitor) {
    return res.status(503).json({
      error: 'Resource monitoring not initialized'
    });
  }
  
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 300000; // Default 5 minutes
    const metrics = resourceMonitor.getMetrics(timeWindow);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('[ResourceMonitoring] Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
}

/**
 * Express route handler to expose real-time resource usage
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function resourceUsageEndpoint(req, res) {
  if (!resourceMonitor) {
    return res.status(503).json({
      error: 'Resource monitoring not initialized'
    });
  }
  
  try {
    const usage = resourceMonitor.getResourceUsage();
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('[ResourceMonitoring] Error getting resource usage:', error);
    res.status(500).json({
      error: 'Failed to retrieve resource usage',
      message: error.message
    });
  }
}

/**
 * Express route handler to get recent alerts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function alertsEndpoint(req, res) {
  if (!resourceMonitor) {
    return res.status(503).json({
      error: 'Resource monitoring not initialized'
    });
  }
  
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 3600000; // Default 1 hour
    const alerts = resourceMonitor.getRecentAlerts(timeWindow);
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        timeWindow
      }
    });
  } catch (error) {
    console.error('[ResourceMonitoring] Error getting alerts:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
}

/**
 * Express route handler to update alert thresholds
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function updateThresholdsEndpoint(req, res) {
  if (!resourceMonitor) {
    return res.status(503).json({
      error: 'Resource monitoring not initialized'
    });
  }
  
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({
        error: 'Invalid thresholds data'
      });
    }
    
    resourceMonitor.setAlertThresholds(thresholds);
    
    res.json({
      success: true,
      message: 'Alert thresholds updated successfully'
    });
  } catch (error) {
    console.error('[ResourceMonitoring] Error updating thresholds:', error);
    res.status(500).json({
      error: 'Failed to update thresholds',
      message: error.message
    });
  }
}

module.exports = {
  initializeResourceMonitor,
  getResourceMonitor,
  resetResourceMonitor,
  requestTrackingMiddleware,
  connectionPoolMonitoringMiddleware,
  metricsEndpoint,
  resourceUsageEndpoint,
  alertsEndpoint,
  updateThresholdsEndpoint
};