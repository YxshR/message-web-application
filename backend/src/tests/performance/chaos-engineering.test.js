/**
 * Chaos Engineering Tests for API Reliability
 * 
 * These tests simulate various failure scenarios and resource exhaustion conditions
 * to validate the system's resilience and recovery capabilities.
 * 
 * Requirements tested:
 * - 2.1-2.3: Connection pool management under stress
 * - 3.1-3.4: Error handling and recovery mechanisms
 * - 4.1-4.4: Monitoring and alerting under failure conditions
 * - 5.1-5.4: Network adaptation and timeout handling
 */

const request = require('supertest');
const { Client } = require('socket.io-client');
const app = require('../../server');
const { pool, query, getPoolHealth, poolMonitor } = require('../../config/database');

describe('Chaos Engineering Tests', () => {
  let server;
  let testUsers = [];
  let authTokens = [];

  beforeAll(async () => {
    server = app.listen(0);
    
    // Reset monitoring
    poolMonitor.reset();
    
    // Clean database
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');

    // Create test users
    console.log('Setting up chaos engineering test environment...');
    for (let i = 1; i <= 10; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: `Chaos User ${i}`,
          email: `chaos${i}@test.com`,
          password: 'password123'
        });
      
      if (response.status === 201) {
        testUsers.push(response.body.user);
        authTokens.push(response.body.token);
      }
    }

    console.log(`Chaos test setup complete: ${testUsers.length} users created`);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await pool.end();
  });

  describe('Database Connection Chaos', () => {
    test('should handle sudden connection drops gracefully', async () => {
      console.log('🔥 Chaos Test: Simulating connection drops...');
      
      // Start normal operations
      const normalOperations = [];
      for (let i = 0; i < 10; i++) {
        const userIndex = i % testUsers.length;
        normalOperations.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
        );
      }
      
      // Simulate connection drops by creating and immediately closing connections
      const chaosOperations = [];
      for (let i = 0; i < 5; i++) {
        chaosOperations.push(
          query('SELECT 1').then(() => {
            // Simulate connection issues by creating invalid queries
            return query('SELECT * FROM nonexistent_table_chaos_test')
              .catch(err => ({ chaosError: err.message }));
          })
        );
      }
      
      // Execute both normal and chaos operations concurrently
      const [normalResults, chaosResults] = await Promise.all([
        Promise.allSettled(normalOperations),
        Promise.allSettled(chaosOperations)
      ]);
      
      // Analyze results
      const successfulNormal = normalResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      console.log(`Connection Chaos Results:`);
      console.log(`- Normal operations successful: ${successfulNormal.length}/10`);
      console.log(`- Chaos operations completed: ${chaosResults.length}`);
      
      // System should maintain some level of service despite chaos
      expect(successfulNormal.length).toBeGreaterThan(5); // At least 50% success
      
      // Pool should recover
      const poolHealth = getPoolHealth();
      expect(poolHealth.pool.totalConnections).toBeGreaterThan(0);
    });

    test('should recover from connection pool exhaustion', async () => {
      console.log('🔥 Chaos Test: Exhausting connection pool...');
      
      const maxConnections = pool.options.max;
      const exhaustionQueries = [];
      
      // Exhaust the connection pool with long-running queries
      for (let i = 0; i < maxConnections; i++) {
        exhaustionQueries.push(
          query('SELECT pg_sleep(3)') // 3-second blocking queries
        );
      }
      
      // Wait for connections to be acquired
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Try to make API requests while pool is exhausted
      const apiRequests = [];
      const requestStartTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        const userIndex = i % testUsers.length;
        apiRequests.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .timeout(8000) // Longer timeout for exhaustion scenario
            .catch(err => ({ 
              error: err.message, 
              status: err.status,
              isTimeout: err.message.includes('timeout')
            }))
        );
      }
      
      // Wait for both exhaustion queries and API requests
      const [exhaustionResults, apiResults] = await Promise.all([
        Promise.allSettled(exhaustionQueries),
        Promise.allSettled(apiRequests)
      ]);
      
      const recoveryTime = Date.now() - requestStartTime;
      
      // Analyze API request results
      const successfulApi = apiResults.filter(r => 
        r.status === 'fulfilled' && 
        r.value.status === 200
      );
      
      const queuedRequests = apiResults.filter(r =>
        r.status === 'fulfilled' && 
        (r.value.status === 503 || r.value.error)
      );
      
      console.log(`Pool Exhaustion Results:`);
      console.log(`- Recovery time: ${recoveryTime}ms`);
      console.log(`- Successful API requests: ${successfulApi.length}/5`);
      console.log(`- Queued/Failed requests: ${queuedRequests.length}/5`);
      
      // System should handle exhaustion gracefully
      expect(recoveryTime).toBeLessThan(10000); // Should recover within 10 seconds
      expect(successfulApi.length + queuedRequests.length).toBe(5); // All requests handled
      
      // Pool should be healthy after recovery
      const finalHealth = getPoolHealth();
      expect(finalHealth.pool.waitingClients).toBe(0);
    }, 15000);
  });

  describe('Memory Pressure Simulation', () => {
    test('should handle memory pressure gracefully', async () => {
      console.log('🔥 Chaos Test: Simulating memory pressure...');
      
      // Create memory pressure by generating large response payloads
      const memoryPressureRequests = [];
      
      // First, create many contacts to increase response size
      const contactCreationPromises = [];
      for (let userIndex = 0; userIndex < testUsers.length; userIndex++) {
        for (let contactIndex = 1; contactIndex <= 50; contactIndex++) {
          contactCreationPromises.push(
            request(app)
              .post('/api/contacts')
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
              .send({
                name: `Memory Test Contact ${contactIndex} with very long name to increase payload size`,
                email: `memorytest${contactIndex}user${userIndex}@example.com`
              })
              .catch(err => ({ error: err.message }))
          );
        }
      }
      
      await Promise.allSettled(contactCreationPromises);
      
      // Now create concurrent requests for large datasets
      for (let i = 0; i < 20; i++) {
        const userIndex = i % testUsers.length;
        memoryPressureRequests.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .timeout(10000)
            .catch(err => ({ 
              error: err.message,
              isMemoryError: err.message.includes('memory') || err.message.includes('heap')
            }))
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(memoryPressureRequests);
      const endTime = Date.now();
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      const memoryErrors = results.filter(r =>
        r.status === 'fulfilled' && r.value.isMemoryError
      );
      
      console.log(`Memory Pressure Results:`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Successful requests: ${successful.length}/20`);
      console.log(`- Memory-related errors: ${memoryErrors.length}`);
      
      // System should handle memory pressure without crashing
      expect(successful.length).toBeGreaterThan(10); // At least 50% success
      expect(endTime - startTime).toBeLessThan(15000); // Complete within 15 seconds
    }, 20000);
  });

  describe('Network Latency Chaos', () => {
    test('should handle simulated network delays', async () => {
      console.log('🔥 Chaos Test: Simulating network delays...');
      
      // Simulate network delays by adding artificial delays in requests
      const delayedRequests = [];
      const delays = [100, 500, 1000, 2000, 3000]; // Various delay amounts
      
      for (let i = 0; i < 15; i++) {
        const userIndex = i % testUsers.length;
        const delay = delays[i % delays.length];
        
        delayedRequests.push(
          new Promise(resolve => {
            setTimeout(async () => {
              try {
                const response = await request(app)
                  .get('/api/contacts')
                  .set('Authorization', `Bearer ${authTokens[userIndex]}`)
                  .timeout(8000);
                
                resolve({ 
                  success: true, 
                  delay, 
                  status: response.status,
                  responseTime: Date.now()
                });
              } catch (error) {
                resolve({ 
                  success: false, 
                  delay, 
                  error: error.message,
                  isTimeout: error.message.includes('timeout')
                });
              }
            }, delay);
          })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.all(delayedRequests);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.success);
      const timeouts = results.filter(r => r.isTimeout);
      const avgDelay = results.reduce((sum, r) => sum + r.delay, 0) / results.length;
      
      console.log(`Network Delay Results:`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Successful requests: ${successful.length}/15`);
      console.log(`- Timeout errors: ${timeouts.length}`);
      console.log(`- Average simulated delay: ${avgDelay}ms`);
      
      // System should handle network delays gracefully
      expect(successful.length).toBeGreaterThan(10); // At least 66% success
      expect(timeouts.length).toBeLessThan(5); // Less than 33% timeouts
    }, 15000);
  });

  describe('Concurrent User Chaos', () => {
    test('should handle user authentication chaos', async () => {
      console.log('🔥 Chaos Test: Authentication chaos...');
      
      const authChaosRequests = [];
      
      // Mix of valid and invalid authentication attempts
      for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) {
          // Invalid credentials
          authChaosRequests.push(
            request(app)
              .post('/api/auth/login')
              .send({
                email: `invalid${i}@test.com`,
                password: 'wrongpassword'
              })
              .catch(err => ({ error: err.message, type: 'invalid_auth' }))
          );
        } else if (i % 3 === 1) {
          // Valid credentials
          const userIndex = i % testUsers.length;
          authChaosRequests.push(
            request(app)
              .post('/api/auth/login')
              .send({
                email: testUsers[userIndex].email,
                password: 'password123'
              })
              .catch(err => ({ error: err.message, type: 'valid_auth_error' }))
          );
        } else {
          // Malformed requests
          authChaosRequests.push(
            request(app)
              .post('/api/auth/login')
              .send({
                email: 'not-an-email',
                password: ''
              })
              .catch(err => ({ error: err.message, type: 'malformed' }))
          );
        }
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(authChaosRequests);
      const endTime = Date.now();
      
      const validAuths = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      const invalidAuths = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 401
      );
      
      const malformedRequests = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 400
      );
      
      console.log(`Authentication Chaos Results:`);
      console.log(`- Total time: ${endTime - startTime}ms`);
      console.log(`- Valid authentications: ${validAuths.length}`);
      console.log(`- Invalid authentications (401): ${invalidAuths.length}`);
      console.log(`- Malformed requests (400): ${malformedRequests.length}`);
      
      // System should handle auth chaos appropriately
      expect(validAuths.length).toBeGreaterThan(5); // Some valid auths should succeed
      expect(invalidAuths.length).toBeGreaterThan(5); // Invalid auths should be rejected
      expect(endTime - startTime).toBeLessThan(10000); // Complete within 10 seconds
    });

    test('should handle concurrent session chaos', async () => {
      console.log('🔥 Chaos Test: Session chaos...');
      
      // Create multiple sessions for the same user
      const user = testUsers[0];
      const sessionTokens = [];
      
      // Create multiple sessions
      for (let i = 0; i < 5; i++) {
        try {
          const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
              email: user.email,
              password: 'password123'
            });
          
          if (loginResponse.status === 200) {
            sessionTokens.push(loginResponse.body.token);
          }
        } catch (error) {
          console.warn(`Session creation ${i} failed:`, error.message);
        }
      }
      
      // Use all sessions concurrently
      const sessionRequests = [];
      for (let i = 0; i < 20; i++) {
        const tokenIndex = i % sessionTokens.length;
        const token = sessionTokens[tokenIndex];
        
        sessionRequests.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .catch(err => ({ 
              error: err.message,
              tokenIndex,
              isAuthError: err.status === 401
            }))
        );
      }
      
      const results = await Promise.allSettled(sessionRequests);
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      const authErrors = results.filter(r =>
        r.status === 'fulfilled' && r.value.isAuthError
      );
      
      console.log(`Session Chaos Results:`);
      console.log(`- Sessions created: ${sessionTokens.length}`);
      console.log(`- Successful requests: ${successful.length}/20`);
      console.log(`- Auth errors: ${authErrors.length}`);
      
      // Multiple sessions should work concurrently
      expect(successful.length).toBeGreaterThan(15); // Most requests should succeed
      expect(authErrors.length).toBeLessThan(5); // Few auth errors expected
    });
  });

  describe('Resource Recovery Tests', () => {
    test('should demonstrate full system recovery after chaos', async () => {
      console.log('🔥 Chaos Test: Full system recovery validation...');
      
      // Create a comprehensive chaos scenario
      const chaosPromises = [];
      
      // Database chaos
      for (let i = 0; i < 3; i++) {
        chaosPromises.push(
          query('SELECT pg_sleep(1)')
            .catch(err => ({ chaosType: 'db', error: err.message }))
        );
      }
      
      // API chaos
      for (let i = 0; i < 10; i++) {
        const userIndex = i % testUsers.length;
        chaosPromises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .timeout(3000)
            .catch(err => ({ chaosType: 'api', error: err.message }))
        );
      }
      
      // Auth chaos
      for (let i = 0; i < 5; i++) {
        chaosPromises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: `chaos${i}@invalid.com`,
              password: 'invalid'
            })
            .catch(err => ({ chaosType: 'auth', error: err.message }))
        );
      }
      
      // Execute chaos
      const chaosStartTime = Date.now();
      await Promise.allSettled(chaosPromises);
      const chaosEndTime = Date.now();
      
      console.log(`Chaos phase completed in ${chaosEndTime - chaosStartTime}ms`);
      
      // Wait for system to stabilize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test recovery with normal operations
      const recoveryPromises = [];
      const recoveryStartTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const userIndex = i % testUsers.length;
        recoveryPromises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
            .expect(200)
        );
      }
      
      const recoveryResults = await Promise.allSettled(recoveryPromises);
      const recoveryEndTime = Date.now();
      
      const successfulRecovery = recoveryResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      console.log(`Recovery Results:`);
      console.log(`- Recovery time: ${recoveryEndTime - recoveryStartTime}ms`);
      console.log(`- Successful recovery requests: ${successfulRecovery.length}/10`);
      
      // System should fully recover
      expect(successfulRecovery.length).toBe(10); // 100% recovery
      expect(recoveryEndTime - recoveryStartTime).toBeLessThan(5000); // Fast recovery
      
      // Check system health
      const finalHealth = getPoolHealth();
      expect(finalHealth.status).not.toBe('critical');
      expect(finalHealth.pool.totalConnections).toBeGreaterThan(0);
      
      console.log('✅ System demonstrated full recovery after chaos');
    }, 20000);
  });

  describe('Monitoring Under Chaos', () => {
    test('should maintain monitoring accuracy during chaos', async () => {
      console.log('🔥 Chaos Test: Monitoring under chaos...');
      
      const initialMetrics = poolMonitor.getMetrics();
      
      // Create chaos while monitoring
      const chaosRequests = [];
      for (let i = 0; i < 25; i++) {
        const userIndex = i % testUsers.length;
        
        if (i % 5 === 0) {
          // Some requests will fail
          chaosRequests.push(
            request(app)
              .get('/api/nonexistent-endpoint')
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
              .catch(err => ({ error: err.message, type: 'not_found' }))
          );
        } else {
          // Normal requests
          chaosRequests.push(
            request(app)
              .get('/api/contacts')
              .set('Authorization', `Bearer ${authTokens[userIndex]}`)
              .catch(err => ({ error: err.message, type: 'normal' }))
          );
        }
      }
      
      await Promise.allSettled(chaosRequests);
      
      const finalMetrics = poolMonitor.getMetrics();
      
      // Verify monitoring captured the chaos
      expect(finalMetrics.totalQueries).toBeGreaterThan(initialMetrics.totalQueries);
      expect(finalMetrics.totalErrors).toBeGreaterThan(initialMetrics.totalErrors);
      
      // Monitoring should still be functional
      expect(finalMetrics.averageQueryTime).toBeGreaterThan(0);
      expect(finalMetrics.errorRate).toBeGreaterThan(0);
      
      console.log(`Monitoring Chaos Results:`);
      console.log(`- Queries tracked: ${finalMetrics.totalQueries - initialMetrics.totalQueries}`);
      console.log(`- Errors tracked: ${finalMetrics.totalErrors - initialMetrics.totalErrors}`);
      console.log(`- Error rate: ${(finalMetrics.errorRate * 100).toFixed(2)}%`);
      
      console.log('✅ Monitoring remained accurate during chaos');
    });
  });
});