const express = require('express');
const router = express.Router();
const {
  metricsEndpoint,
  resourceUsageEndpoint,
  alertsEndpoint,
  updateThresholdsEndpoint
} = require('../middleware/resourceMonitoring');

/**
 * @route GET /api/monitoring/metrics
 * @desc Get performance metrics for specified time window
 * @query {number} timeWindow - Time window in milliseconds (default: 300000 = 5 minutes)
 * @access Private (should be protected in production)
 */
router.get('/metrics', metricsEndpoint);

/**
 * @route GET /api/monitoring/resource-usage
 * @desc Get real-time resource usage summary
 * @access Private (should be protected in production)
 */
router.get('/resource-usage', resourceUsageEndpoint);

/**
 * @route GET /api/monitoring/alerts
 * @desc Get recent alerts for specified time window
 * @query {number} timeWindow - Time window in milliseconds (default: 3600000 = 1 hour)
 * @access Private (should be protected in production)
 */
router.get('/alerts', alertsEndpoint);

/**
 * @route PUT /api/monitoring/thresholds
 * @desc Update alert thresholds
 * @body {Object} thresholds - New threshold values
 * @access Private (should be protected in production)
 */
router.put('/thresholds', updateThresholdsEndpoint);

/**
 * @route GET /api/monitoring/health
 * @desc Simple health check endpoint for monitoring systems
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

module.exports = router;