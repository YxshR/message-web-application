const request = require('supertest');
const express = require('express');
const {
  initializeResourceMonitor,
  getResourceMonitor,
  resetResourceMonitor,
  requestTrackingMiddleware,
  connectionPoolMonitoringMiddleware,
  metricsEndpoint,
  resourceUsageEndpoint,
  alertsEndpoint,
  updateThresholdsEndpoint
} = require('../middleware/resourceMonitoring');

describe('Resource Monitoring Integration', () => {
  let app;
  let monitor;

  beforeEach(() => {
    // Reset global state
    resetResourceMonitor();
    
    app = express();
    app.use(express.json());
    
    // Initialize monitor for testing
    monitor = initializeResourceMonitor({
      metricsRetentionMs: 60000,
      alertCooldownMs: 1000,
      alertThresholds: {
        maxActiveConnections: 5,
        maxQueuedRequests: 10,
        maxResponseTime: 1000,
        maxErrorRate: 0.1,
        minThroughput: 1
      }
    });

    // Add monitoring middleware
    app.use(requestTrackingMiddleware);

    // Test routes
    app.get('/test/success', (req, res) => {
      res.json({ success: true });
    });

    app.get('/test/error', (req, res) => {
      res.status(500).json({ error: 'Test error' });
    });

    // Monitoring endpoints
    app.get('/metrics', metricsEndpoint);
    app.get('/resource-usage', resourceUsageEndpoint);
    app.get('/alerts', alertsEndpoint);
    app.put('/thresholds', updateThresholdsEndpoint);
  });

  afterEach(() => {
    resetResourceMonitor();
  });

  describe('Basic Functionality', () => {
    test('should track successful requests', async () => {
      await request(app)
        .get('/test/success')
        .expect(200);

      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.successful).toBeGreaterThan(0);
    });

    test('should track failed requests', async () => {
      await request(app)
        .get('/test/error')
        .expect(500);

      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBeGreaterThan(0);
      expect(metrics.requests.failed).toBeGreaterThan(0);
    });

    test('should return metrics via endpoint', async () => {
      await request(app).get('/test/success');

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('requests');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('connectionPool');
    });

    test('should return resource usage via endpoint', async () => {
      await request(app).get('/test/success');

      const response = await request(app)
        .get('/resource-usage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('connectionPool');
      expect(response.body.data).toHaveProperty('performance');
      expect(response.body.data).toHaveProperty('health');
    });

    test('should update alert thresholds', async () => {
      const newThresholds = {
        maxActiveConnections: 15,
        maxResponseTime: 2000
      };

      const response = await request(app)
        .put('/thresholds')
        .send({ thresholds: newThresholds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(monitor.alertThresholds.maxActiveConnections).toBe(15);
      expect(monitor.alertThresholds.maxResponseTime).toBe(2000);
    });
  });

  describe('Connection Pool Monitoring', () => {
    test('should update connection pool metrics', async () => {
      const mockPool = {
        numUsed: () => 3,
        numFree: () => 2,
        numPendingAcquires: () => 1
      };

      const poolApp = express();
      poolApp.use(express.json());
      poolApp.use(requestTrackingMiddleware);
      poolApp.use(connectionPoolMonitoringMiddleware(mockPool));
      poolApp.get('/test', (req, res) => res.json({ success: true }));

      await request(poolApp)
        .get('/test')
        .expect(200);

      const metrics = monitor.getMetrics();
      expect(metrics.connectionPool.active).toBe(3);
      expect(metrics.connectionPool.idle).toBe(2);
      expect(metrics.connectionPool.total).toBe(5);
      expect(metrics.connectionPool.queued).toBe(1);
    });

    test('should handle missing pool gracefully', async () => {
      const poolApp = express();
      poolApp.use(requestTrackingMiddleware);
      poolApp.use(connectionPoolMonitoringMiddleware(null));
      poolApp.get('/test', (req, res) => res.json({ success: true }));

      await request(poolApp)
        .get('/test')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle monitor not initialized for metrics', async () => {
      resetResourceMonitor();

      const response = await request(app)
        .get('/metrics')
        .expect(503);

      expect(response.body.error).toBe('Resource monitoring not initialized');
    });

    test('should handle monitor not initialized for resource usage', async () => {
      resetResourceMonitor();

      const response = await request(app)
        .get('/resource-usage')
        .expect(503);

      expect(response.body.error).toBe('Resource monitoring not initialized');
    });

    test('should handle monitor not initialized for alerts', async () => {
      resetResourceMonitor();

      const response = await request(app)
        .get('/alerts')
        .expect(503);

      expect(response.body.error).toBe('Resource monitoring not initialized');
    });

    test('should handle monitor not initialized for thresholds', async () => {
      resetResourceMonitor();

      const response = await request(app)
        .put('/thresholds')
        .send({ thresholds: { maxActiveConnections: 15 } })
        .expect(503);

      expect(response.body.error).toBe('Resource monitoring not initialized');
    });

    test('should validate thresholds data', async () => {
      await request(app)
        .put('/thresholds')
        .send({ invalid: 'data' })
        .expect(400);
    });

    test('should handle missing thresholds', async () => {
      await request(app)
        .put('/thresholds')
        .send({})
        .expect(400);
    });
  });

  describe('Monitor Management', () => {
    test('should return existing monitor if already initialized', () => {
      const existingMonitor = getResourceMonitor();
      const newMonitor = initializeResourceMonitor();
      
      expect(newMonitor).toBe(existingMonitor);
    });

    test('should return null if monitor not initialized', () => {
      resetResourceMonitor();
      
      const result = getResourceMonitor();
      expect(result).toBeNull();
    });

    test('should work without monitor initialized', async () => {
      resetResourceMonitor();

      const app2 = express();
      app2.use(requestTrackingMiddleware);
      app2.get('/test', (req, res) => res.json({ success: true }));

      await request(app2)
        .get('/test')
        .expect(200);
    });
  });

  describe('Alert System Integration', () => {
    test('should return alerts via endpoint', async () => {
      // Trigger some requests to generate potential alerts
      await request(app).get('/test/success');
      await request(app).get('/test/error');

      const response = await request(app)
        .get('/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.alerts)).toBe(true);
    });

    test('should accept time window parameter for alerts', async () => {
      const response = await request(app)
        .get('/alerts?timeWindow=3600000')
        .expect(200);

      expect(response.body.data.timeWindow).toBe(3600000);
    });

    test('should accept time window parameter for metrics', async () => {
      await request(app).get('/test/success');

      const response = await request(app)
        .get('/metrics?timeWindow=60000')
        .expect(200);

      expect(response.body.data.timeWindow).toBe(60000);
    });
  });
});