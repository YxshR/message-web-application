const { 
  pool, 
  query, 
  transaction, 
  testConnection, 
  gracefulShutdown, 
  getPoolHealth,
  poolMonitor,
  requestQueue 
} = require('../config/database');

describe('Enhanced Connection Pool', () => {
  beforeAll(async () => {
    // Ensure database is connected
    const isConnected = await testConnection();
    expect(isConnected).toBe(true);
  });

  afterAll(async () => {
    // Clean shutdown
    await gracefulShutdown();
  });

  beforeEach(async () => {
    // Reset monitoring metrics
    poolMonitor.reset();
    requestQueue.clear();
    
    // Clean up test data
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');
  });

  describe('Connection Pool Configuration', () => {
    test('should have enhanced pool configuration', () => {
      expect(pool.options.max).toBeGreaterThanOrEqual(5);
      expect(pool.options.min).toBeGreaterThanOrEqual(1);
      expect(pool.options.acquireTimeoutMillis).toBeGreaterThan(0);
      expect(pool.options.createTimeoutMillis).toBeGreaterThan(0);
      expect(pool.options.idleTimeoutMillis).toBeGreaterThan(0);
    });

    test('should maintain minimum connections', async () => {
      // Wait for pool to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const health = getPoolHealth();
      expect(health.pool.totalConnections).toBeGreaterThanOrEqual(pool.options.min || 1);
    });
  });

  describe('Connection Pool Monitoring', () => {
    test('should track query metrics', async () => {
      const initialMetrics = poolMonitor.getMetrics();
      
      await query('SELECT 1 as test');
      await query('SELECT 2 as test');
      
      const updatedMetrics = poolMonitor.getMetrics();
      expect(updatedMetrics.totalQueries).toBe(initialMetrics.totalQueries + 2);
      expect(updatedMetrics.averageQueryTime).toBeGreaterThan(0);
    });

    test('should track error metrics', async () => {
      const initialMetrics = poolMonitor.getMetrics();
      
      try {
        await query('SELECT * FROM nonexistent_table');
      } catch (err) {
        // Expected error
      }
      
      const updatedMetrics = poolMonitor.getMetrics();
      expect(updatedMetrics.totalErrors).toBe(initialMetrics.totalErrors + 1);
      expect(updatedMetrics.errorRate).toBeGreaterThan(0);
    });

    test('should provide pool health information', async () => {
      const health = getPoolHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('pool');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.pool).toHaveProperty('totalConnections');
      expect(health.pool).toHaveProperty('idleConnections');
      expect(health.pool).toHaveProperty('waitingClients');
      expect(health.pool).toHaveProperty('queueSize');
    });
  });

  describe('Request Queuing', () => {
    test('should queue requests when pool is at capacity', async () => {
      // Create a long-running query to occupy connections
      const longRunningQueries = [];
      const maxConnections = pool.options.max;
      
      // Fill up the connection pool
      for (let i = 0; i < maxConnections; i++) {
        longRunningQueries.push(
          query('SELECT pg_sleep(0.5)') // 500ms sleep
        );
      }
      
      // This query should be queued
      const queuedQueryStart = Date.now();
      const queuedQuery = query('SELECT 1 as queued_result');
      
      // Wait for all queries to complete
      await Promise.all([...longRunningQueries, queuedQuery]);
      
      const queuedQueryDuration = Date.now() - queuedQueryStart;
      
      // The queued query should take longer than 500ms since it had to wait
      expect(queuedQueryDuration).toBeGreaterThan(400);
    }, 10000);

    test('should handle queue overflow gracefully', async () => {
      // Fill up the request queue beyond its capacity
      const queuePromises = [];
      const queueSize = 100; // Default queue size
      
      // Create more requests than the queue can handle
      for (let i = 0; i < queueSize + 10; i++) {
        queuePromises.push(
          requestQueue.enqueue(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return i;
          }).catch(err => err)
        );
      }
      
      const results = await Promise.all(queuePromises);
      
      // Some requests should have been rejected
      const rejectedRequests = results.filter(result => result instanceof Error);
      expect(rejectedRequests.length).toBeGreaterThan(0);
      
      // Check that the error message is appropriate
      expect(rejectedRequests[0].message).toContain('queue is full');
    });

    test('should prioritize high-priority requests', async () => {
      const results = [];
      
      // Add low priority requests
      requestQueue.enqueue(async () => {
        results.push('low-1');
        return 'low-1';
      }, 0);
      
      requestQueue.enqueue(async () => {
        results.push('low-2');
        return 'low-2';
      }, 0);
      
      // Add high priority request
      requestQueue.enqueue(async () => {
        results.push('high-1');
        return 'high-1';
      }, 10);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // High priority request should be processed first
      expect(results[0]).toBe('high-1');
    });
  });

  describe('Concurrent Load Testing', () => {
    test('should handle concurrent queries without errors', async () => {
      const concurrentQueries = 50;
      const queries = [];
      
      for (let i = 0; i < concurrentQueries; i++) {
        queries.push(
          query('SELECT $1 as query_number, NOW() as timestamp', [i])
        );
      }
      
      const results = await Promise.all(queries);
      
      expect(results).toHaveLength(concurrentQueries);
      results.forEach((result, index) => {
        expect(result.rows[0].query_number).toBe(index);
        expect(result.rows[0].timestamp).toBeInstanceOf(Date);
      });
      
      // Check that metrics were updated
      const metrics = poolMonitor.getMetrics();
      expect(metrics.totalQueries).toBeGreaterThanOrEqual(concurrentQueries);
    }, 15000);

    test('should handle concurrent transactions', async () => {
      const concurrentTransactions = 20;
      const transactions = [];
      
      for (let i = 0; i < concurrentTransactions; i++) {
        transactions.push(
          transaction(async (client) => {
            // Insert a test user
            const result = await client.query(
              'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
              [`User ${i}`, `user${i}@test.com`, 'hash']
            );
            return result.rows[0].id;
          })
        );
      }
      
      const userIds = await Promise.all(transactions);
      
      expect(userIds).toHaveLength(concurrentTransactions);
      userIds.forEach(id => {
        expect(typeof id).toBe('number');
      });
      
      // Verify all users were created
      const userCount = await query('SELECT COUNT(*) as count FROM users');
      expect(parseInt(userCount.rows[0].count)).toBe(concurrentTransactions);
    }, 20000);

    test('should maintain performance under sustained load', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = Date.now();
      const queries = [];
      let queryCount = 0;
      
      // Generate queries for the test duration
      while (Date.now() - startTime < testDuration) {
        queries.push(
          query('SELECT $1 as query_id, pg_backend_pid() as backend_pid', [queryCount++])
            .catch(err => ({ error: err.message }))
        );
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const results = await Promise.all(queries);
      
      // Check that most queries succeeded
      const successfulQueries = results.filter(result => !result.error);
      const errorRate = (results.length - successfulQueries.length) / results.length;
      
      expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
      
      // Check performance metrics
      const metrics = poolMonitor.getMetrics();
      expect(metrics.averageQueryTime).toBeLessThan(1000); // Average query time under 1 second
    }, 10000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle connection timeouts gracefully', async () => {
      // Test with a very short timeout
      await expect(
        query('SELECT pg_sleep(2)', [], { timeout: 1000 })
      ).rejects.toThrow();
      
      // Pool should still be functional after timeout
      const result = await query('SELECT 1 as recovery_test');
      expect(result.rows[0].recovery_test).toBe(1);
    });

    test('should recover from connection errors', async () => {
      // Simulate connection error by trying to query with invalid SQL
      try {
        await query('INVALID SQL STATEMENT');
      } catch (err) {
        // Expected error
      }
      
      // Pool should still be functional
      const result = await query('SELECT 1 as recovery_test');
      expect(result.rows[0].recovery_test).toBe(1);
      
      // Check that error was recorded
      const metrics = poolMonitor.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
    });

    test('should handle transaction rollbacks correctly', async () => {
      await expect(
        transaction(async (client) => {
          await client.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            ['Test User', 'test@example.com', 'hash']
          );
          
          // Force an error to trigger rollback
          throw new Error('Forced transaction error');
        })
      ).rejects.toThrow('Forced transaction error');
      
      // Verify that the user was not created (transaction rolled back)
      const result = await query('SELECT COUNT(*) as count FROM users WHERE email = $1', ['test@example.com']);
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should provide graceful shutdown capability', async () => {
      // This test uses a separate pool to avoid affecting other tests
      const { Pool } = require('pg');
      const testPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'messaging_app',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 5
      });
      
      // Start some queries
      const queries = [];
      for (let i = 0; i < 3; i++) {
        queries.push(testPool.query('SELECT pg_sleep(0.1)'));
      }
      
      // Initiate shutdown
      const shutdownPromise = testPool.end();
      
      // Wait for queries and shutdown to complete
      await Promise.all([...queries, shutdownPromise]);
      
      // Pool should be closed
      expect(testPool.ended).toBe(true);
    });
  });
});