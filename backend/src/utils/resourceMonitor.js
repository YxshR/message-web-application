const EventEmitter = require('events');

/**
 * ResourceMonitor class to track API performance metrics and resource usage
 * Implements requirements 4.1, 4.2, 4.3, 4.4 for monitoring and alerting
 */
class ResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      metricsRetentionMs: options.metricsRetentionMs || 300000, // 5 minutes
      alertCooldownMs: options.alertCooldownMs || 60000, // 1 minute
      ...options
    };
    
    // Metrics storage
    this.metrics = {
      requests: [],
      connectionPool: {
        active: 0,
        idle: 0,
        total: 0,
        queued: 0
      },
      alerts: []
    };
    
    // Alert thresholds
    this.alertThresholds = {
      maxActiveConnections: 18,
      maxQueuedRequests: 100,
      maxResponseTime: 5000,
      maxErrorRate: 0.05,
      minThroughput: 1,
      ...options.alertThresholds
    };
    
    // Alert cooldown tracking
    this.lastAlerts = new Map();
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Clean up every minute
  }

  /**
   * Track an API request with timing and success metrics
   * @param {string} endpoint - The API endpoint
   * @param {number} duration - Request duration in milliseconds
   * @param {boolean} success - Whether the request was successful
   * @param {Object} metadata - Additional metadata about the request
   */
  trackRequest(endpoint, duration, success, metadata = {}) {
    const timestamp = Date.now();
    
    const requestMetric = {
      endpoint,
      duration,
      success,
      timestamp,
      metadata
    };
    
    this.metrics.requests.push(requestMetric);
    
    // Log the request
    console.log(`[ResourceMonitor] Request tracked: ${endpoint} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`);
    
    // Check for alerts
    this.checkAlerts();
    
    // Emit event for real-time monitoring
    this.emit('requestTracked', requestMetric);
  }

  /**
   * Update connection pool metrics
   * @param {Object} poolStats - Connection pool statistics
   */
  updateConnectionPoolMetrics(poolStats) {
    this.metrics.connectionPool = {
      active: poolStats.active || 0,
      idle: poolStats.idle || 0,
      total: poolStats.total || 0,
      queued: poolStats.queued || 0,
      timestamp: Date.now()
    };
    
    console.log(`[ResourceMonitor] Pool metrics updated: Active=${poolStats.active}, Idle=${poolStats.idle}, Queued=${poolStats.queued}`);
    
    // Check for connection pool alerts
    this.checkConnectionPoolAlerts();
    
    // Emit event for real-time monitoring
    this.emit('connectionPoolUpdated', this.metrics.connectionPool);
  }

  /**
   * Get current performance metrics for a specific time window
   * @param {number} timeWindowMs - Time window in milliseconds (default: 5 minutes)
   * @returns {Object} Current metrics
   */
  getMetrics(timeWindowMs = 300000) {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentRequests = this.metrics.requests.filter(req => req.timestamp >= cutoffTime);
    
    const totalRequests = recentRequests.length;
    const successfulRequests = recentRequests.filter(req => req.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const responseTimes = recentRequests.map(req => req.duration);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    const throughput = totalRequests / (timeWindowMs / 1000); // requests per second
    
    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95 = this.calculatePercentile(sortedTimes, 95);
    const p99 = this.calculatePercentile(sortedTimes, 99);
    
    return {
      timeWindow: timeWindowMs,
      timestamp: Date.now(),
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        errorRate
      },
      performance: {
        averageResponseTime,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        throughput
      },
      connectionPool: { ...this.metrics.connectionPool },
      alerts: this.getRecentAlerts(timeWindowMs)
    };
  }

  /**
   * Set alert thresholds for monitoring
   * @param {Object} thresholds - Alert threshold configuration
   */
  setAlertThresholds(thresholds) {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('[ResourceMonitor] Alert thresholds updated:', this.alertThresholds);
  }

  /**
   * Register an alert callback
   * @param {Function} callback - Callback function to handle alerts
   */
  onAlert(callback) {
    this.on('alert', callback);
  }

  /**
   * Check for performance and resource alerts
   */
  checkAlerts() {
    const metrics = this.getMetrics(60000); // Check last minute
    const now = Date.now();
    
    // Check error rate
    if (metrics.requests.errorRate > this.alertThresholds.maxErrorRate) {
      this.triggerAlert('HIGH_ERROR_RATE', {
        current: metrics.requests.errorRate,
        threshold: this.alertThresholds.maxErrorRate,
        message: `Error rate ${(metrics.requests.errorRate * 100).toFixed(2)}% exceeds threshold ${(this.alertThresholds.maxErrorRate * 100).toFixed(2)}%`
      });
    }
    
    // Check response time
    if (metrics.performance.averageResponseTime > this.alertThresholds.maxResponseTime) {
      this.triggerAlert('HIGH_RESPONSE_TIME', {
        current: metrics.performance.averageResponseTime,
        threshold: this.alertThresholds.maxResponseTime,
        message: `Average response time ${metrics.performance.averageResponseTime}ms exceeds threshold ${this.alertThresholds.maxResponseTime}ms`
      });
    }
    
    // Check throughput
    if (metrics.performance.throughput < this.alertThresholds.minThroughput && metrics.requests.total > 0) {
      this.triggerAlert('LOW_THROUGHPUT', {
        current: metrics.performance.throughput,
        threshold: this.alertThresholds.minThroughput,
        message: `Throughput ${metrics.performance.throughput.toFixed(2)} req/s below threshold ${this.alertThresholds.minThroughput} req/s`
      });
    }
  }

  /**
   * Check for connection pool specific alerts
   */
  checkConnectionPoolAlerts() {
    const pool = this.metrics.connectionPool;
    
    // Check active connections
    if (pool.active > this.alertThresholds.maxActiveConnections) {
      this.triggerAlert('HIGH_CONNECTION_USAGE', {
        current: pool.active,
        threshold: this.alertThresholds.maxActiveConnections,
        message: `Active connections ${pool.active} exceeds threshold ${this.alertThresholds.maxActiveConnections}`
      });
    }
    
    // Check queued requests
    if (pool.queued > this.alertThresholds.maxQueuedRequests) {
      this.triggerAlert('HIGH_QUEUE_SIZE', {
        current: pool.queued,
        threshold: this.alertThresholds.maxQueuedRequests,
        message: `Queued requests ${pool.queued} exceeds threshold ${this.alertThresholds.maxQueuedRequests}`
      });
    }
  }

  /**
   * Trigger an alert with cooldown logic
   * @param {string} type - Alert type
   * @param {Object} data - Alert data
   */
  triggerAlert(type, data) {
    const now = Date.now();
    const lastAlert = this.lastAlerts.get(type);
    
    // Check cooldown
    if (lastAlert && (now - lastAlert) < this.options.alertCooldownMs) {
      return; // Still in cooldown period
    }
    
    const alert = {
      type,
      timestamp: now,
      severity: this.getAlertSeverity(type),
      ...data
    };
    
    this.metrics.alerts.push(alert);
    this.lastAlerts.set(type, now);
    
    console.warn(`[ResourceMonitor] ALERT [${alert.severity}] ${type}: ${alert.message}`);
    
    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Get alert severity based on type
   * @param {string} type - Alert type
   * @returns {string} Severity level
   */
  getAlertSeverity(type) {
    const severityMap = {
      'HIGH_ERROR_RATE': 'CRITICAL',
      'HIGH_RESPONSE_TIME': 'WARNING',
      'LOW_THROUGHPUT': 'WARNING',
      'HIGH_CONNECTION_USAGE': 'CRITICAL',
      'HIGH_QUEUE_SIZE': 'CRITICAL'
    };
    
    return severityMap[type] || 'INFO';
  }

  /**
   * Get recent alerts within time window
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Array} Recent alerts
   */
  getRecentAlerts(timeWindowMs = 300000) {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.metrics.alerts.filter(alert => alert.timestamp >= cutoffTime);
  }

  /**
   * Calculate percentile from sorted array
   * @param {Array} sortedArray - Sorted array of numbers
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - this.options.metricsRetentionMs;
    
    // Clean up old requests
    this.metrics.requests = this.metrics.requests.filter(req => req.timestamp >= cutoffTime);
    
    // Clean up old alerts
    this.metrics.alerts = this.metrics.alerts.filter(alert => alert.timestamp >= cutoffTime);
    
    console.log(`[ResourceMonitor] Cleaned up metrics older than ${this.options.metricsRetentionMs}ms`);
  }

  /**
   * Get real-time resource usage summary
   * @returns {Object} Current resource usage
   */
  getResourceUsage() {
    const metrics = this.getMetrics(60000); // Last minute
    
    return {
      timestamp: Date.now(),
      connectionPool: this.metrics.connectionPool,
      performance: metrics.performance,
      health: {
        errorRate: metrics.requests.errorRate,
        responseTime: metrics.performance.averageResponseTime,
        throughput: metrics.performance.throughput,
        activeAlerts: this.getRecentAlerts(300000).length
      }
    };
  }

  /**
   * Destroy the monitor and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.removeAllListeners();
    console.log('[ResourceMonitor] Monitor destroyed');
  }
}

module.exports = ResourceMonitor;