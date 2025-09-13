const { 
  pool, 
  query, 
  transaction, 
  getPoolHealth,
  poolMonitor 
} = require('../../config/database');

describe('Connection Pool Load Testing', () => {
  beforeAll(async () => {
    // Reset monitoring
    poolMonitor.reset();
  });

  afterAll(async () => {
    // Don't close pool here as other tests might need it
  });

  beforeEach(async () => {
    // Clean up test data
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');
  });

  describe('High Concurrency Scenarios', () => {
    test('should handle burst of 100 concurrent queries', async () => {
      const startTime = Date.now();
      const concurrentQueries = 100;
      const queries = [];
      
      for (let i = 0; i < concurrentQueries; i++) {
        queries.push(
          query('SELECT $1 as query_id, NOW() as timestamp, pg_backend_pid() as pid', [i])
            .catch(err => ({ error: err.message, queryId: i }))
        );
      }
      
      const results = await Promise.all(queries);
      const duration = Date.now() - startTime;
      
      // Analyze results
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      
      console.log(`Burst test completed in ${duration}ms`);
      console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);
      
      // Should handle most queries successfully
      expect(successful.length).toBeGreaterThan(concurrentQueries * 0.8); // At least 80% success
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
      
      // Check pool health after burst
      const health = getPoolHealth();
      expect(health.status).not.toBe('critical');
    }, 15000);

    test('should handle sustained load over time', async () => {
      const testDuration = 10000; // 10 seconds
      const queryInterval = 50; // Query every 50ms
      const startTime = Date.now();
      const results = [];
      let queryId = 0;
      
      const loadTest = async () => {
        while (Date.now() - startTime < testDuration) {
          const currentQueryId = queryId++;
          
          try {
            const result = await query(
              'SELECT $1 as query_id, NOW() as timestamp', 
              [currentQueryId]
            );
            results.push({ success: true, queryId: currentQueryId, duration: Date.now() - startTime });
          } catch (err) {
            results.push({ success: false, queryId: currentQueryId, error: err.message });
          }
          
          await new Promise(resolve => setTimeout(resolve, queryInterval));
        }
      };
      
      await loadTest();
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      const errorRate = failed.length / results.length;
      
      console.log(`Sustained load test: ${results.length} queries over ${testDuration}ms`);
      console.log(`Success rate: ${(successful.length / results.length * 100).toFixed(2)}%`);
      
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(results.length).toBeGreaterThan(100); // Should have processed many queries
      
      // Check final pool health
      const health = getPoolHealth();
      const metrics = poolMonitor.getMetrics();
      
      expect(metrics.averageQueryTime).toBeLessThan(500); // Average under 500ms
      expect(health.pool.totalConnections).toBeLessThanOrEqual(pool.options.max);
    }, 15000);

    test('should handle mixed query and transaction load', async () => {
      const testDuration = 8000; // 8 seconds
      const startTime = Date.now();
      const operations = [];
      let operationId = 0;
      
      // Generate mixed load
      while (Date.now() - startTime < testDuration) {
        const currentOpId = operationId++;
        
        if (currentOpId % 3 === 0) {
          // Transaction operation
          operations.push(
            transaction(async (client) => {
              const userResult = await client.query(
                'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
                [`User ${currentOpId}`, `user${currentOpId}@test.com`, 'hash']
              );
              
              // Simulate some work
              await client.query('SELECT pg_sleep(0.01)'); // 10ms
              
              return userResult.rows[0].id;
            }).catch(err => ({ error: err.message, type: 'transaction', opId: currentOpId }))
          );
        } else {
          // Regular query operation
          operations.push(
            query('SELECT $1 as op_id, COUNT(*) as user_count FROM users', [currentOpId])
              .catch(err => ({ error: err.message, type: 'query', opId: currentOpId }))
          );
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      const results = await Promise.all(operations);
      
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      const transactions = results.filter(r => r.type === 'transaction' || (r.rows && r.rows.length === 0));
      
      console.log(`Mixed load test: ${results.length} operations`);
      console.log(`Successful: ${successful.length}, Failed: ${failed.length}`);
      
      expect(successful.length).toBeGreaterThan(results.length * 0.85); // At least 85% success
      
      // Verify some users were created
      const userCount = await query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(userCount.rows[0].count)).toBeGreaterThan(0);
    }, 12000);
  });

  describe('Connection Pool Saturation', () => {
    test('should handle connection pool saturation gracefully', async () => {
      const maxConnections = pool.options.max;
      const longRunningQueries = [];
      
      // Fill up the connection pool with long-running queries
      for (let i = 0; i < maxConnections; i++) {
        longRunningQueries.push(
          query('SELECT pg_sleep(2)') // 2 second sleep
        );
      }
      
      // Wait a moment for connections to be acquired
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now try to execute additional queries - these should be queued
      const additionalQueries = [];
      for (let i = 0; i < 10; i++) {
        additionalQueries.push(
          query('SELECT $1 as additional_query', [i])
        );
      }
      
      // All queries should eventually complete
      const allResults = await Promise.all([...longRunningQueries, ...additionalQueries]);
      
      expect(allResults).toHaveLength(maxConnections + 10);
      
      // Check that additional queries have the expected results
      const additionalResults = allResults.slice(maxConnections);
      additionalResults.forEach((result, index) => {
        expect(result.rows[0].additional_query).toBe(index);
      });
      
      // Pool should be healthy after saturation test
      const health = getPoolHealth();
      expect(health.pool.waitingClients).toBe(0); // No more waiting clients
    }, 10000);

    test('should maintain performance during connection churn', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const operations = [];
      
      // Create rapid connection acquisition and release
      while (Date.now() - startTime < testDuration) {
        operations.push(
          query('SELECT NOW() as timestamp, pg_backend_pid() as pid')
            .catch(err => ({ error: err.message }))
        );
        
        // Very short delay to create churn
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      
      const results = await Promise.all(operations);
      const successful = results.filter(r => !r.error);
      const failed = results.filter(r => r.error);
      
      console.log(`Connection churn test: ${results.length} operations`);
      console.log(`Success rate: ${(successful.length / results.length * 100).toFixed(2)}%`);
      
      // Should maintain good performance even with rapid churn
      expect(successful.length / results.length).toBeGreaterThan(0.9); // 90% success rate
      
      // Check that we used different backend processes (connection reuse)
      const uniquePids = new Set(successful.map(r => r.rows[0].pid));
      expect(uniquePids.size).toBeLessThanOrEqual(pool.options.max);
      expect(uniquePids.size).toBeGreaterThan(1); // Should use multiple connections
    }, 8000);
  });

  describe('Resource Monitoring Under Load', () => {
    test('should accurately track metrics during load', async () => {
      const initialMetrics = poolMonitor.getMetrics();
      const queryCount = 50;
      const queries = [];
      
      // Execute a known number of queries
      for (let i = 0; i < queryCount; i++) {
        queries.push(
          query('SELECT $1 as query_number', [i])
        );
      }
      
      await Promise.all(queries);
      
      const finalMetrics = poolMonitor.getMetrics();
      
      // Verify metrics were updated correctly
      expect(finalMetrics.totalQueries).toBe(initialMetrics.totalQueries + queryCount);
      expect(finalMetrics.averageQueryTime).toBeGreaterThan(0);
      expect(finalMetrics.totalErrors).toBe(initialMetrics.totalErrors); // No errors expected
    });

    test('should detect and report unhealthy conditions', async () => {
      // Force some errors to trigger unhealthy status
      const errorQueries = [];
      for (let i = 0; i < 20; i++) {
        errorQueries.push(
          query('SELECT * FROM nonexistent_table')
            .catch(err => ({ error: err.message }))
        );
      }
      
      await Promise.all(errorQueries);
      
      const health = getPoolHealth();
      const metrics = poolMonitor.getMetrics();
      
      // Should detect high error rate
      expect(metrics.errorRate).toBeGreaterThan(0);
      expect(metrics.totalErrors).toBeGreaterThan(0);
      
      // Health status should reflect the errors
      if (metrics.errorRate > 0.1) {
        expect(health.status).toBe('unhealthy');
      }
    });
  });

  describe('Recovery and Resilience', () => {
    test('should recover from temporary connection issues', async () => {
      // Simulate recovery by executing successful queries after errors
      try {
        await query('INVALID SQL TO CAUSE ERROR');
      } catch (err) {
        // Expected error
      }
      
      // Pool should recover and handle subsequent queries
      const recoveryQueries = [];
      for (let i = 0; i < 10; i++) {
        recoveryQueries.push(
          query('SELECT $1 as recovery_test', [i])
        );
      }
      
      const results = await Promise.all(recoveryQueries);
      
      // All recovery queries should succeed
      results.forEach((result, index) => {
        expect(result.rows[0].recovery_test).toBe(index);
      });
      
      // Pool should be healthy again
      const health = getPoolHealth();
      expect(health.pool.totalConnections).toBeGreaterThan(0);
    });
  });
});