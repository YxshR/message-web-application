/**
 * Concurrent Contacts Fetching Load Tests
 * 
 * Tests the API reliability optimization features under various concurrent load scenarios:
 * - Request deduplication effectiveness
 * - Connection pool saturation handling
 * - Resource exhaustion recovery
 * - Performance benchmarks
 * 
 * Requirements tested:
 * - 1.1: Limit concurrent API requests to prevent resource exhaustion
 * - 1.2: Implement exponential backoff retry logic
 * - 1.3: Deduplicate requests to reduce server load
 * - 2.1-2.3: Connection pooling and resource management
 * - 3.1-3.4: Error handling and user feedback
 */

const request = require('supertest');
const { Client } = require('socket.io-client');
const app = require('../../server');
const { pool, query, getPoolHealth, poolMonitor } = require('../../config/database');

describe('Concurrent Contacts Fetching Load Tests', () => {
  let server;
  let testUsers = [];
  let authTokens = [];
  let testContacts = [];

  beforeAll(async () => {
    // Start server on random port
    server = app.listen(0);
    const port = server.address().port;
    
    // Reset monitoring
    poolMonitor.reset();
    
    // Clean database
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');

    // Create test users for concurrent testing
    console.log('Setting up test users for concurrent contacts load testing...');
    for (let i = 1; i <= 20; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@loadtest.com`,
          password: 'password123'
        });
      
      if (response.status === 201) {
        testUsers.push(response.body.user);
        authTokens.push(response.body.token);
      }
    }

    // Create test contacts for each user
    console.log('Creating test contacts...');
    for (let userIndex = 0; userIndex < testUsers.length; userIndex++) {
      const userContacts = [];
      
      for (let contactIndex = 1; contactIndex <= 10; contactIndex++) {
        const contactResponse = await request(app)
          .post('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[userIndex]}`)
          .send({
            name: `Contact ${contactIndex} for User ${userIndex + 1}`,
            email: `contact${contactIndex}user${userIndex + 1}@test.com`
          });
        
        if (contactResponse.status === 201) {
          userContacts.push(contactResponse.body.contact);
        }
      }
      
      testContacts.push(userContacts);
    }

    console.log(`Setup complete: ${testUsers.length} users, ${testContacts.flat().length} total contacts`);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await pool.end();
  });

  describe('Request Deduplication Effectiveness', () => {
    test('should deduplicate identical concurrent contacts requests', async () => {
      const concurrentRequests = 50;
      const userIndex = 0;
      const token = authTokens[userIndex];
      
      // Track database queries before test
      const initialMetrics = poolMonitor.getMetrics();
      
      // Create identical concurrent requests
      const promises = Array(concurrentRequests).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // Verify all responses are identical (indicating deduplication)
      const firstResponse = responses[0].body;
      responses.forEach((response, index) => {
        expect(response.body).toEqual(firstResponse);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.contacts)).toBe(true);
      });

      // Check performance metrics
      const finalMetrics = poolMonitor.getMetrics();
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentRequests;
      
      console.log(`Deduplication Test Results:`);
      console.log(`- ${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
      console.log(`- Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Database queries executed: ${finalMetrics.totalQueries - initialMetrics.totalQueries}`);
      
      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms indicates good deduplication
      
      // Database efficiency check - should use fewer queries than requests due to deduplication
      const queryIncrease = finalMetrics.totalQueries - initialMetrics.totalQueries;
      expect(queryIncrease).toBeLessThan(concurrentRequests); // Should be significantly less
      
      console.log(`- Deduplication effectiveness: ${((1 - queryIncrease / concurrentRequests) * 100).toFixed(2)}%`);
    }, 10000);

    test('should handle different search parameters without false deduplication', async () => {
      const userIndex = 1;
      const token = authTokens[userIndex];
      const searchTerms = ['Contact 1', 'Contact 2', 'Contact 3', 'nonexistent', ''];
      
      // Create concurrent requests with different search parameters
      const promises = searchTerms.flatMap(searchTerm =>
        Array(10).fill().map(() =>
          request(app)
            .get('/api/contacts')
            .query(searchTerm ? { search: searchTerm } : {})
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
        )
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      // Group responses by search term
      const responseGroups = {};
      let responseIndex = 0;
      
      for (const searchTerm of searchTerms) {
        responseGroups[searchTerm] = responses.slice(responseIndex, responseIndex + 10);
        responseIndex += 10;
      }
      
      // Verify responses within each group are identical (deduplication working)
      // but different groups have different results (no false deduplication)
      for (const [searchTerm, groupResponses] of Object.entries(responseGroups)) {
        const firstResponse = groupResponses[0].body;
        
        // All responses in group should be identical
        groupResponses.forEach(response => {
          expect(response.body).toEqual(firstResponse);
        });
        
        // Verify search filtering worked correctly
        if (searchTerm && searchTerm !== '') {
          const contacts = firstResponse.contacts;
          contacts.forEach(contact => {
            expect(contact.name.toLowerCase()).toContain(searchTerm.toLowerCase());
          });
        }
      }
      
      const totalTime = endTime - startTime;
      console.log(`Search parameter test: ${responses.length} requests in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
    }, 12000);
  });

  describe('Connection Pool Saturation Tests', () => {
    test('should handle connection pool saturation gracefully', async () => {
      const maxConnections = pool.options.max;
      const overloadFactor = 2; // Request 2x more connections than available
      const totalRequests = maxConnections * overloadFactor;
      
      console.log(`Testing connection pool saturation: ${totalRequests} requests, ${maxConnections} max connections`);
      
      // Create requests that will saturate the connection pool
      const promises = [];
      for (let i = 0; i < totalRequests; i++) {
        const userIndex = i % testUsers.length;
        const token = authTokens[userIndex];
        
        promises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .timeout(15000) // Longer timeout for saturation test
        );
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const failed = results.filter(r => r.status === 'rejected' || r.value.status !== 200);
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && (r.value.status === 429 || r.value.status === 503)
      );
      
      const totalTime = endTime - startTime;
      const successRate = successful.length / totalRequests;
      
      console.log(`Connection Pool Saturation Results:`);
      console.log(`- Total requests: ${totalRequests}`);
      console.log(`- Successful: ${successful.length} (${(successRate * 100).toFixed(2)}%)`);
      console.log(`- Rate limited/Service unavailable: ${rateLimited.length}`);
      console.log(`- Failed: ${failed.length}`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Throughput: ${(totalRequests / (totalTime / 1000)).toFixed(2)} req/s`);
      
      // Assertions for graceful degradation
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // Should handle overload gracefully (rate limiting instead of crashes)
      const gracefulHandling = (successful.length + rateLimited.length) / totalRequests;
      expect(gracefulHandling).toBeGreaterThan(0.9); // 90% should be handled gracefully
      
      // Check pool health after saturation
      const poolHealth = getPoolHealth();
      expect(poolHealth.pool.totalConnections).toBeLessThanOrEqual(maxConnections);
      expect(poolHealth.pool.waitingClients).toBe(0); // No hanging clients
    }, 35000);

    test('should recover quickly from connection pool exhaustion', async () => {
      // First, saturate the pool
      const maxConnections = pool.options.max;
      const saturationPromises = [];
      
      for (let i = 0; i < maxConnections; i++) {
        saturationPromises.push(
          query('SELECT pg_sleep(2)') // 2-second blocking queries
        );
      }
      
      // Wait a moment for connections to be acquired
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now test recovery with normal requests
      const recoveryPromises = [];
      const recoveryStartTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        const userIndex = i % testUsers.length;
        const token = authTokens[userIndex];
        
        recoveryPromises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .timeout(10000)
        );
      }
      
      // Wait for saturation queries to complete and recovery requests to process
      await Promise.all([
        Promise.all(saturationPromises),
        Promise.all(recoveryPromises)
      ]);
      
      const recoveryTime = Date.now() - recoveryStartTime;
      
      console.log(`Recovery test: Pool recovered in ${recoveryTime}ms`);
      
      // Recovery should be reasonably fast
      expect(recoveryTime).toBeLessThan(5000); // Should recover within 5 seconds
      
      // Pool should be healthy after recovery
      const poolHealth = getPoolHealth();
      expect(poolHealth.status).not.toBe('critical');
      expect(poolHealth.pool.waitingClients).toBe(0);
    }, 15000);
  });

  describe('Resource Exhaustion and Recovery', () => {
    test('should handle ERR_INSUFFICIENT_RESOURCES gracefully', async () => {
      // Create a burst of requests to trigger resource exhaustion
      const burstSize = 100;
      const promises = [];
      
      console.log(`Testing resource exhaustion with ${burstSize} concurrent requests...`);
      
      for (let i = 0; i < burstSize; i++) {
        const userIndex = i % testUsers.length;
        const token = authTokens[userIndex];
        
        promises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .timeout(20000)
            .catch(err => ({ error: err.message, status: err.status }))
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      // Analyze response patterns
      const successful = results.filter(r => r.status === 200);
      const resourceErrors = results.filter(r => 
        r.status === 503 || 
        (r.error && r.error.includes('INSUFFICIENT_RESOURCES'))
      );
      const otherErrors = results.filter(r => 
        r.error && !r.error.includes('INSUFFICIENT_RESOURCES') && r.status !== 503
      );
      
      const totalTime = endTime - startTime;
      
      console.log(`Resource Exhaustion Test Results:`);
      console.log(`- Successful responses: ${successful.length}`);
      console.log(`- Resource exhaustion errors: ${resourceErrors.length}`);
      console.log(`- Other errors: ${otherErrors.length}`);
      console.log(`- Total time: ${totalTime}ms`);
      
      // Should handle resource exhaustion gracefully
      expect(successful.length + resourceErrors.length).toBeGreaterThan(burstSize * 0.8);
      expect(otherErrors.length).toBeLessThan(burstSize * 0.1); // Less than 10% unexpected errors
      
      // Test recovery after burst
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const recoveryResponse = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .expect(200);
      
      expect(recoveryResponse.body.success).toBe(true);
      console.log('✅ System recovered successfully after resource exhaustion');
    }, 25000);

    test('should maintain data consistency under high load', async () => {
      const userIndex = 0;
      const token = authTokens[userIndex];
      const initialContactsResponse = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const initialContacts = initialContactsResponse.body.contacts;
      const initialCount = initialContacts.length;
      
      // Create high concurrent load
      const concurrentRequests = 50;
      const promises = Array(concurrentRequests).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${token}`)
      );

      await Promise.all(promises);
      
      // Verify data consistency after load
      const finalContactsResponse = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      const finalContacts = finalContactsResponse.body.contacts;
      
      // Data should be consistent
      expect(finalContacts.length).toBe(initialCount);
      expect(finalContacts).toEqual(initialContacts);
      
      console.log(`✅ Data consistency maintained through ${concurrentRequests} concurrent requests`);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet response time requirements under normal load', async () => {
      const normalLoad = 20;
      const promises = [];
      const responseTimes = [];
      
      for (let i = 0; i < normalLoad; i++) {
        const userIndex = i % testUsers.length;
        const token = authTokens[userIndex];
        
        const startTime = Date.now();
        promises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)
            .then(response => {
              const responseTime = Date.now() - startTime;
              responseTimes.push(responseTime);
              return response;
            })
        );
      }

      await Promise.all(promises);
      
      // Calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      const avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      
      console.log(`Performance Benchmarks (${normalLoad} requests):`);
      console.log(`- Average: ${avg.toFixed(2)}ms`);
      console.log(`- 50th percentile: ${p50}ms`);
      console.log(`- 95th percentile: ${p95}ms`);
      console.log(`- 99th percentile: ${p99}ms`);
      
      // Performance requirements (from requirements.md)
      expect(p95).toBeLessThan(5000); // 95% under 5 seconds
      expect(p99).toBeLessThan(10000); // 99% under 10 seconds
      expect(avg).toBeLessThan(1000); // Average under 1 second for normal load
    });

    test('should maintain throughput under sustained load', async () => {
      const testDuration = 10000; // 10 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      const completedRequests = [];
      
      console.log(`Testing sustained throughput for ${testDuration}ms...`);
      
      let requestCount = 0;
      const intervalId = setInterval(async () => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(intervalId);
          return;
        }
        
        const userIndex = requestCount % testUsers.length;
        const token = authTokens[userIndex];
        requestCount++;
        
        const requestStartTime = Date.now();
        try {
          await request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${token}`)
            .timeout(5000);
          
          completedRequests.push({
            requestId: requestCount,
            responseTime: Date.now() - requestStartTime,
            timestamp: Date.now()
          });
        } catch (error) {
          // Log but don't fail the test for individual request failures
          console.warn(`Request ${requestCount} failed:`, error.message);
        }
      }, requestInterval);
      
      // Wait for test duration plus buffer
      await new Promise(resolve => setTimeout(resolve, testDuration + 2000));
      clearInterval(intervalId);
      
      const actualDuration = (completedRequests[completedRequests.length - 1]?.timestamp || Date.now()) - startTime;
      const throughput = completedRequests.length / (actualDuration / 1000);
      const avgResponseTime = completedRequests.reduce((sum, req) => sum + req.responseTime, 0) / completedRequests.length;
      
      console.log(`Sustained Load Results:`);
      console.log(`- Completed requests: ${completedRequests.length}`);
      console.log(`- Test duration: ${actualDuration}ms`);
      console.log(`- Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`- Average response time: ${avgResponseTime.toFixed(2)}ms`);
      
      // Throughput requirements
      expect(throughput).toBeGreaterThan(5); // At least 5 req/s sustained
      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds under sustained load
      expect(completedRequests.length).toBeGreaterThan(testDuration / requestInterval * 0.8); // 80% success rate
    }, 15000);
  });

  describe('Deduplication Effectiveness Benchmarks', () => {
    test('should demonstrate significant performance improvement with deduplication', async () => {
      const testRequests = 30;
      const userIndex = 0;
      const token = authTokens[userIndex];
      
      // Test without deduplication (simulate by using different cache-busting parameters)
      console.log('Testing without deduplication...');
      const withoutDeduplicationPromises = Array(testRequests).fill().map((_, index) =>
        request(app)
          .get('/api/contacts')
          .query({ _cacheBust: index }) // Different parameters to prevent deduplication
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      );
      
      const startTimeWithout = Date.now();
      await Promise.all(withoutDeduplicationPromises);
      const timeWithoutDeduplication = Date.now() - startTimeWithout;
      
      // Test with deduplication (identical requests)
      console.log('Testing with deduplication...');
      const withDeduplicationPromises = Array(testRequests).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${token}`)
          .expect(200)
      );
      
      const startTimeWith = Date.now();
      await Promise.all(withDeduplicationPromises);
      const timeWithDeduplication = Date.now() - startTimeWith;
      
      const improvementRatio = timeWithoutDeduplication / timeWithDeduplication;
      const improvementPercent = ((timeWithoutDeduplication - timeWithDeduplication) / timeWithoutDeduplication) * 100;
      
      console.log(`Deduplication Effectiveness:`);
      console.log(`- Without deduplication: ${timeWithoutDeduplication}ms`);
      console.log(`- With deduplication: ${timeWithDeduplication}ms`);
      console.log(`- Improvement ratio: ${improvementRatio.toFixed(2)}x`);
      console.log(`- Performance improvement: ${improvementPercent.toFixed(2)}%`);
      
      // Deduplication should provide significant performance improvement
      expect(improvementRatio).toBeGreaterThan(1.5); // At least 50% improvement
      expect(timeWithDeduplication).toBeLessThan(timeWithoutDeduplication);
    });
  });
});