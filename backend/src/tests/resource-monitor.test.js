const ResourceMonitor = require('../utils/resourceMonitor');

describe('ResourceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new ResourceMonitor({
      metricsRetentionMs: 60000, // 1 minute for testing
      alertCooldownMs: 1000, // 1 second for testing
      alertThresholds: {
        maxActiveConnections: 5,
        maxQueuedRequests: 10,
        maxResponseTime: 1000,
        maxErrorRate: 0.1,
        minThroughput: 1
      }
    });
  });

  afterEach(() => {
    if (monitor) {
      monitor.destroy();
    }
  });

  describe('Request Tracking', () => {
    test('should track successful requests', () => {
      monitor.trackRequest('/api/contacts', 500, true);
      
      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.successful).toBe(1);
      expect(metrics.requests.failed).toBe(0);
      expect(metrics.performance.averageResponseTime).toBe(500);
    });

    test('should track failed requests', () => {
      monitor.trackRequest('/api/contacts', 1500, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.successful).toBe(0);
      expect(metrics.requests.failed).toBe(1);
      expect(metrics.requests.errorRate).toBe(1);
    });

    test('should calculate correct error rate', () => {
      monitor.trackRequest('/api/contacts', 500, true);
      monitor.trackRequest('/api/users', 600, true);
      monitor.trackRequest('/api/messages', 700, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBe(3);
      expect(metrics.requests.errorRate).toBeCloseTo(0.333, 2);
    });

    test('should calculate response time percentiles', () => {
      const responseTimes = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      
      responseTimes.forEach(time => {
        monitor.trackRequest('/api/test', time, true);
      });
      
      const metrics = monitor.getMetrics();
      expect(metrics.performance.p95ResponseTime).toBe(1000); // 95th percentile of 10 items is the 10th item
      expect(metrics.performance.p99ResponseTime).toBe(1000); // 99th percentile of 10 items is also the 10th item
    });

    test('should emit requestTracked event', (done) => {
      monitor.on('requestTracked', (requestMetric) => {
        expect(requestMetric.endpoint).toBe('/api/test');
        expect(requestMetric.duration).toBe(500);
        expect(requestMetric.success).toBe(true);
        done();
      });

      monitor.trackRequest('/api/test', 500, true);
    });
  });

  describe('Connection Pool Monitoring', () => {
    test('should update connection pool metrics', () => {
      const poolStats = {
        active: 3,
        idle: 2,
        total: 5,
        queued: 1
      };

      monitor.updateConnectionPoolMetrics(poolStats);
      
      const metrics = monitor.getMetrics();
      expect(metrics.connectionPool.active).toBe(3);
      expect(metrics.connectionPool.idle).toBe(2);
      expect(metrics.connectionPool.total).toBe(5);
      expect(metrics.connectionPool.queued).toBe(1);
    });

    test('should emit connectionPoolUpdated event', (done) => {
      const poolStats = {
        active: 3,
        idle: 2,
        total: 5,
        queued: 1
      };

      monitor.on('connectionPoolUpdated', (poolMetrics) => {
        expect(poolMetrics.active).toBe(3);
        expect(poolMetrics.idle).toBe(2);
        done();
      });

      monitor.updateConnectionPoolMetrics(poolStats);
    });
  });

  describe('Alert System', () => {
    test('should trigger high error rate alert', (done) => {
      let alertReceived = false;
      
      monitor.on('alert', (alert) => {
        if (alert.type === 'HIGH_ERROR_RATE' && !alertReceived) {
          alertReceived = true;
          expect(alert.type).toBe('HIGH_ERROR_RATE');
          expect(alert.severity).toBe('CRITICAL');
          expect(alert.current).toBeGreaterThan(monitor.alertThresholds.maxErrorRate);
          done();
        }
      });

      // Generate requests with high error rate
      for (let i = 0; i < 10; i++) {
        monitor.trackRequest('/api/test', 500, i < 2); // 80% error rate
      }
    });

    test('should trigger high response time alert', (done) => {
      let alertReceived = false;
      
      monitor.on('alert', (alert) => {
        if (alert.type === 'HIGH_RESPONSE_TIME' && !alertReceived) {
          alertReceived = true;
          expect(alert.type).toBe('HIGH_RESPONSE_TIME');
          expect(alert.severity).toBe('WARNING');
          expect(alert.current).toBeGreaterThan(monitor.alertThresholds.maxResponseTime);
          done();
        }
      });

      monitor.trackRequest('/api/test', 2000, true); // Above threshold
    });

    test('should trigger high connection usage alert', (done) => {
      monitor.on('alert', (alert) => {
        expect(alert.type).toBe('HIGH_CONNECTION_USAGE');
        expect(alert.severity).toBe('CRITICAL');
        expect(alert.current).toBeGreaterThan(monitor.alertThresholds.maxActiveConnections);
        done();
      });

      monitor.updateConnectionPoolMetrics({
        active: 10, // Above threshold of 5
        idle: 0,
        total: 10,
        queued: 0
      });
    });

    test('should trigger high queue size alert', (done) => {
      monitor.on('alert', (alert) => {
        expect(alert.type).toBe('HIGH_QUEUE_SIZE');
        expect(alert.severity).toBe('CRITICAL');
        expect(alert.current).toBeGreaterThan(monitor.alertThresholds.maxQueuedRequests);
        done();
      });

      monitor.updateConnectionPoolMetrics({
        active: 5,
        idle: 0,
        total: 5,
        queued: 15 // Above threshold of 10
      });
    });

    test('should respect alert cooldown period', (done) => {
      let errorRateAlerts = 0;
      
      monitor.on('alert', (alert) => {
        if (alert.type === 'HIGH_ERROR_RATE') {
          errorRateAlerts++;
        }
      });

      // Trigger multiple high error rate conditions
      for (let i = 0; i < 10; i++) {
        monitor.trackRequest('/api/test', 500, false);
      }

      setTimeout(() => {
        // Should only have one HIGH_ERROR_RATE alert due to cooldown
        expect(errorRateAlerts).toBe(1);
        done();
      }, 500);
    });

    test('should update alert thresholds', () => {
      const newThresholds = {
        maxActiveConnections: 15,
        maxResponseTime: 2000
      };

      monitor.setAlertThresholds(newThresholds);
      
      expect(monitor.alertThresholds.maxActiveConnections).toBe(15);
      expect(monitor.alertThresholds.maxResponseTime).toBe(2000);
      // Should preserve existing thresholds
      expect(monitor.alertThresholds.maxErrorRate).toBe(0.1);
    });
  });

  describe('Metrics Calculation', () => {
    test('should calculate throughput correctly', () => {
      const startTime = Date.now();
      
      // Add 10 requests
      for (let i = 0; i < 10; i++) {
        monitor.trackRequest('/api/test', 500, true);
      }
      
      const metrics = monitor.getMetrics(5000); // 5 second window
      expect(metrics.performance.throughput).toBe(2); // 10 requests / 5 seconds
    });

    test('should filter metrics by time window', () => {
      // Add old request (should be filtered out)
      monitor.metrics.requests.push({
        endpoint: '/api/old',
        duration: 500,
        success: true,
        timestamp: Date.now() - 10000 // 10 seconds ago
      });

      // Add recent request
      monitor.trackRequest('/api/recent', 600, true);
      
      const metrics = monitor.getMetrics(5000); // 5 second window
      expect(metrics.requests.total).toBe(1); // Only recent request
    });

    test('should handle empty metrics gracefully', () => {
      const metrics = monitor.getMetrics();
      
      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.errorRate).toBe(0);
      expect(metrics.performance.averageResponseTime).toBe(0);
      expect(metrics.performance.throughput).toBe(0);
    });
  });

  describe('Resource Usage', () => {
    test('should return current resource usage', () => {
      monitor.trackRequest('/api/test', 500, true);
      monitor.updateConnectionPoolMetrics({
        active: 3,
        idle: 2,
        total: 5,
        queued: 0
      });

      const usage = monitor.getResourceUsage();
      
      expect(usage).toHaveProperty('timestamp');
      expect(usage).toHaveProperty('connectionPool');
      expect(usage).toHaveProperty('performance');
      expect(usage).toHaveProperty('health');
      expect(usage.connectionPool.active).toBe(3);
    });
  });

  describe('Cleanup and Memory Management', () => {
    test('should clean up old metrics', (done) => {
      // Add old metrics
      monitor.metrics.requests.push({
        endpoint: '/api/old',
        duration: 500,
        success: true,
        timestamp: Date.now() - 120000 // 2 minutes ago
      });

      monitor.metrics.alerts.push({
        type: 'TEST_ALERT',
        timestamp: Date.now() - 120000,
        severity: 'INFO'
      });

      // Trigger cleanup
      monitor.cleanupOldMetrics();

      // Old metrics should be removed
      expect(monitor.metrics.requests.length).toBe(0);
      expect(monitor.metrics.alerts.length).toBe(0);
      done();
    });

    test('should destroy monitor and clean up resources', () => {
      const spy = jest.spyOn(monitor, 'removeAllListeners');
      
      monitor.destroy();
      
      expect(spy).toHaveBeenCalled();
      expect(monitor.cleanupInterval).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle percentile calculation with empty array', () => {
      const result = monitor.calculatePercentile([], 95);
      expect(result).toBe(0);
    });

    test('should handle percentile calculation with single value', () => {
      const result = monitor.calculatePercentile([100], 95);
      expect(result).toBe(100);
    });

    test('should handle invalid pool stats gracefully', () => {
      monitor.updateConnectionPoolMetrics({});
      
      const metrics = monitor.getMetrics();
      expect(metrics.connectionPool.active).toBe(0);
      expect(metrics.connectionPool.idle).toBe(0);
    });

    test('should handle request tracking with metadata', () => {
      const metadata = {
        statusCode: 200,
        method: 'GET',
        userAgent: 'test-agent'
      };

      monitor.trackRequest('/api/test', 500, true, metadata);
      
      expect(monitor.metrics.requests[0].metadata).toEqual(metadata);
    });
  });
});