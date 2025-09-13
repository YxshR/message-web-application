const ResourceMonitor = require('../../utils/resourceMonitor');

describe('Resource Monitor Performance Tests', () => {
  let monitor;

  beforeEach(() => {
    monitor = new ResourceMonitor({
      metricsRetentionMs: 300000, // 5 minutes
      alertCooldownMs: 1000,
      alertThresholds: {
        maxActiveConnections: 50,
        maxQueuedRequests: 100,
        maxResponseTime: 2000,
        maxErrorRate: 0.1,
        minThroughput: 10
      }
    });
  });

  afterEach(() => {
    if (monitor) {
      monitor.destroy();
    }
  });

  describe('High Volume Request Tracking', () => {
    test('should handle 1000 concurrent request tracking calls', async () => {
      const startTime = Date.now();
      const promises = [];

      // Generate 1000 concurrent requests
      for (let i = 0; i < 1000; i++) {
        promises.push(
          new Promise(resolve => {
            monitor.trackRequest(`/api/test/${i}`, Math.random() * 1000, Math.random() > 0.1);
            resolve();
          })
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`Processed 1000 requests in ${duration}ms`);
      
      const metrics = monitor.getMetrics();
      expect(metrics.requests.total).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should maintain performance with large metrics history', async () => {
      // Generate 5000 requests over time
      for (let i = 0; i < 5000; i++) {
        monitor.trackRequest(`/api/test/${i}`, Math.random() * 1000, Math.random() > 0.05);
        
        // Simulate time passing
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const startTime = Date.now();
      const metrics = monitor.getMetrics();
      const duration = Date.now() - startTime;

      console.log(`Retrieved metrics with 5000 requests in ${duration}ms`);
      
      expect(metrics.requests.total).toBe(5000);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    test('should handle rapid connection pool updates', async () => {
      const startTime = Date.now();
      
      // Simulate rapid pool updates
      for (let i = 0; i < 1000; i++) {
        monitor.updateConnectionPoolMetrics({
          active: Math.floor(Math.random() * 20),
          idle: Math.floor(Math.random() * 10),
          total: 20,
          queued: Math.floor(Math.random() * 5)
        });
      }

      const duration = Date.now() - startTime;
      console.log(`Processed 1000 pool updates in ${duration}ms`);
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage and Cleanup', () => {
    test('should not leak memory with continuous request tracking', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate requests continuously
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 100; i++) {
          monitor.trackRequest(`/api/batch${batch}/test${i}`, Math.random() * 1000, Math.random() > 0.1);
        }
        
        // Force cleanup periodically
        if (batch % 3 === 0) {
          monitor.cleanupOldMetrics();
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should cleanup old metrics efficiently', () => {
      // Add many old metrics
      const oldTimestamp = Date.now() - 400000; // 6+ minutes ago
      
      for (let i = 0; i < 1000; i++) {
        monitor.metrics.requests.push({
          endpoint: `/api/old/${i}`,
          duration: 500,
          success: true,
          timestamp: oldTimestamp
        });
      }

      // Add some recent metrics
      for (let i = 0; i < 100; i++) {
        monitor.trackRequest(`/api/recent/${i}`, 500, true);
      }

      expect(monitor.metrics.requests.length).toBe(1100);

      const startTime = Date.now();
      monitor.cleanupOldMetrics();
      const duration = Date.now() - startTime;

      console.log(`Cleaned up 1000 old metrics in ${duration}ms`);
      
      expect(monitor.metrics.requests.length).toBe(100); // Only recent metrics remain
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Alert System Performance', () => {
    test('should handle alert checking efficiently under load', async () => {
      let alertCount = 0;
      monitor.on('alert', () => alertCount++);

      const startTime = Date.now();
      
      // Generate many requests that should trigger alerts
      for (let i = 0; i < 500; i++) {
        monitor.trackRequest('/api/test', 3000, false); // High response time, failed
      }

      const duration = Date.now() - startTime;
      console.log(`Processed 500 alert-triggering requests in ${duration}ms, alerts: ${alertCount}`);
      
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(alertCount).toBeGreaterThan(0); // Should have triggered some alerts
      expect(alertCount).toBeLessThan(10); // But not too many due to cooldown
    });

    test('should maintain alert cooldown under high frequency events', async () => {
      let alertCount = 0;
      monitor.on('alert', () => alertCount++);

      // Trigger many connection pool alerts rapidly
      for (let i = 0; i < 100; i++) {
        monitor.updateConnectionPoolMetrics({
          active: 60, // Above threshold
          idle: 0,
          total: 60,
          queued: 0
        });
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should only have a few alerts due to cooldown
      expect(alertCount).toBeLessThan(5);
    });
  });

  describe('Concurrent Access', () => {
    test('should handle concurrent metric retrieval safely', async () => {
      // Start continuous request tracking
      const trackingPromise = new Promise(resolve => {
        let count = 0;
        const interval = setInterval(() => {
          monitor.trackRequest('/api/concurrent', Math.random() * 1000, Math.random() > 0.1);
          count++;
          if (count >= 100) {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      // Concurrently retrieve metrics many times
      const metricsPromises = [];
      for (let i = 0; i < 50; i++) {
        metricsPromises.push(
          new Promise(resolve => {
            setTimeout(() => {
              const metrics = monitor.getMetrics();
              expect(metrics).toHaveProperty('requests');
              expect(metrics).toHaveProperty('performance');
              resolve();
            }, Math.random() * 1000);
          })
        );
      }

      await Promise.all([trackingPromise, ...metricsPromises]);
    });

    test('should handle concurrent pool updates and metric retrieval', async () => {
      const promises = [];

      // Concurrent pool updates
      for (let i = 0; i < 25; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              monitor.updateConnectionPoolMetrics({
                active: Math.floor(Math.random() * 20),
                idle: Math.floor(Math.random() * 10),
                total: 20,
                queued: Math.floor(Math.random() * 5)
              });
              resolve();
            }, Math.random() * 500);
          })
        );
      }

      // Concurrent metric retrievals
      for (let i = 0; i < 25; i++) {
        promises.push(
          new Promise(resolve => {
            setTimeout(() => {
              const usage = monitor.getResourceUsage();
              expect(usage).toHaveProperty('connectionPool');
              resolve();
            }, Math.random() * 500);
          })
        );
      }

      await Promise.all(promises);
    });
  });

  describe('Percentile Calculation Performance', () => {
    test('should calculate percentiles efficiently with large datasets', () => {
      // Generate large dataset
      const responseTimes = [];
      for (let i = 0; i < 10000; i++) {
        responseTimes.push(Math.random() * 5000);
      }

      const startTime = Date.now();
      
      // Sort the array (this is what happens in percentile calculation)
      const sortedTimes = responseTimes.sort((a, b) => a - b);
      const p95 = monitor.calculatePercentile(sortedTimes, 95);
      const p99 = monitor.calculatePercentile(sortedTimes, 99);
      
      const duration = Date.now() - startTime;
      
      console.log(`Calculated percentiles for 10k values in ${duration}ms`);
      console.log(`P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(100); // Should be fast
      expect(p95).toBeGreaterThan(0);
      expect(p99).toBeGreaterThan(p95);
    });
  });

  describe('Event Emitter Performance', () => {
    test('should handle many event listeners efficiently', () => {
      // Add many listeners
      for (let i = 0; i < 100; i++) {
        monitor.on('requestTracked', () => {
          // Simulate some work
          Math.random() * 1000;
        });
      }

      const startTime = Date.now();
      
      // Emit many events
      for (let i = 0; i < 100; i++) {
        monitor.trackRequest('/api/test', 500, true);
      }

      const duration = Date.now() - startTime;
      console.log(`Emitted 100 events to 100 listeners in ${duration}ms`);
      
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});