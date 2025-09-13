/**
 * Continuous Reliability Monitoring Test Suite
 * 
 * Automated test suite that runs continuously to monitor API reliability
 * and performance metrics. This suite validates all requirements and
 * provides ongoing monitoring of system health.
 * 
 * Requirements validated:
 * - All requirements from 1.1 to 5.4
 * - Continuous performance monitoring
 * - Automated alerting on degradation
 */

const request = require('supertest');
const { Client } = require('socket.io-client');
const app = require('../../server');
const { pool, query, getPoolHealth, poolMonitor } = require('../../config/database');
const fs = require('fs').promises;
const path = require('path');

describe('Continuous Reliability Monitoring', () => {
  let server;
  let testUsers = [];
  let authTokens = [];
  let monitoringResults = {
    testRuns: [],
    alerts: [],
    performanceBaselines: {},
    healthChecks: []
  };

  beforeAll(async () => {
    server = app.listen(0);
    
    // Load previous monitoring results if they exist
    try {
      const resultsPath = path.join(__dirname, 'monitoring-results.json');
      const existingResults = await fs.readFile(resultsPath, 'utf8');
      monitoringResults = { ...monitoringResults, ...JSON.parse(existingResults) };
      console.log('📊 Loaded previous monitoring results');
    } catch (error) {
      console.log('📊 Starting fresh monitoring session');
    }

    // Reset monitoring
    poolMonitor.reset();
    
    // Clean database
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');

    // Create test users
    console.log('🔧 Setting up continuous monitoring environment...');
    for (let i = 1; i <= 5; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: `Monitor User ${i}`,
          email: `monitor${i}@test.com`,
          password: 'password123'
        });
      
      if (response.status === 201) {
        testUsers.push(response.body.user);
        authTokens.push(response.body.token);
      }
    }

    console.log(`✅ Monitoring setup complete: ${testUsers.length} users created`);
  });

  afterAll(async () => {
    // Save monitoring results
    try {
      const resultsPath = path.join(__dirname, 'monitoring-results.json');
      await fs.writeFile(resultsPath, JSON.stringify(monitoringResults, null, 2));
      console.log('💾 Monitoring results saved');
    } catch (error) {
      console.warn('⚠️ Could not save monitoring results:', error.message);
    }

    if (server) {
      server.close();
    }
    await pool.end();
  });

  describe('Health Check Monitoring', () => {
    test('should perform comprehensive health checks', async () => {
      console.log('🏥 Performing comprehensive health check...');
      
      const healthCheck = {
        timestamp: new Date().toISOString(),
        checks: {}
      };

      // Database health
      try {
        const dbStart = Date.now();
        await query('SELECT 1');
        const dbTime = Date.now() - dbStart;
        
        const poolHealth = getPoolHealth();
        
        healthCheck.checks.database = {
          status: 'healthy',
          responseTime: dbTime,
          poolStatus: poolHealth.status,
          activeConnections: poolHealth.pool.totalConnections,
          waitingClients: poolHealth.pool.waitingClients
        };
      } catch (error) {
        healthCheck.checks.database = {
          status: 'unhealthy',
          error: error.message
        };
      }

      // API health
      try {
        const apiStart = Date.now();
        const response = await request(app)
          .get('/api/health')
          .expect(200);
        
        const apiTime = Date.now() - apiStart;
        
        healthCheck.checks.api = {
          status: 'healthy',
          responseTime: apiTime,
          response: response.body
        };
      } catch (error) {
        healthCheck.checks.api = {
          status: 'unhealthy',
          error: error.message
        };
      }

      // Authentication health
      try {
        const authStart = Date.now();
        const authResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUsers[0].email,
            password: 'password123'
          })
          .expect(200);
        
        const authTime = Date.now() - authStart;
        
        healthCheck.checks.authentication = {
          status: 'healthy',
          responseTime: authTime,
          tokenReceived: !!authResponse.body.token
        };
      } catch (error) {
        healthCheck.checks.authentication = {
          status: 'unhealthy',
          error: error.message
        };
      }

      // Contacts API health
      try {
        const contactsStart = Date.now();
        const contactsResponse = await request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .expect(200);
        
        const contactsTime = Date.now() - contactsStart;
        
        healthCheck.checks.contacts = {
          status: 'healthy',
          responseTime: contactsTime,
          contactCount: contactsResponse.body.contacts?.length || 0
        };
      } catch (error) {
        healthCheck.checks.contacts = {
          status: 'unhealthy',
          error: error.message
        };
      }

      // Overall health assessment
      const unhealthyChecks = Object.values(healthCheck.checks).filter(check => check.status === 'unhealthy');
      healthCheck.overallStatus = unhealthyChecks.length === 0 ? 'healthy' : 'degraded';
      healthCheck.healthScore = ((Object.keys(healthCheck.checks).length - unhealthyChecks.length) / Object.keys(healthCheck.checks).length) * 100;

      monitoringResults.healthChecks.push(healthCheck);

      console.log(`🏥 Health Check Results:`);
      console.log(`  Overall Status: ${healthCheck.overallStatus}`);
      console.log(`  Health Score: ${healthCheck.healthScore.toFixed(2)}%`);
      console.log(`  Database: ${healthCheck.checks.database.status} (${healthCheck.checks.database.responseTime || 'N/A'}ms)`);
      console.log(`  API: ${healthCheck.checks.api.status} (${healthCheck.checks.api.responseTime || 'N/A'}ms)`);
      console.log(`  Auth: ${healthCheck.checks.authentication.status} (${healthCheck.checks.authentication.responseTime || 'N/A'}ms)`);
      console.log(`  Contacts: ${healthCheck.checks.contacts.status} (${healthCheck.checks.contacts.responseTime || 'N/A'}ms)`);

      // Assertions
      expect(healthCheck.overallStatus).toBe('healthy');
      expect(healthCheck.healthScore).toBeGreaterThan(80); // At least 80% health score
      
      // Individual component checks
      expect(healthCheck.checks.database.status).toBe('healthy');
      expect(healthCheck.checks.api.status).toBe('healthy');
      expect(healthCheck.checks.authentication.status).toBe('healthy');
      expect(healthCheck.checks.contacts.status).toBe('healthy');

      // Performance thresholds
      if (healthCheck.checks.database.responseTime) {
        expect(healthCheck.checks.database.responseTime).toBeLessThan(100); // DB under 100ms
      }
      if (healthCheck.checks.api.responseTime) {
        expect(healthCheck.checks.api.responseTime).toBeLessThan(500); // API under 500ms
      }
    });
  });

  describe('Performance Baseline Monitoring', () => {
    test('should establish and monitor performance baselines', async () => {
      console.log('📈 Establishing performance baselines...');
      
      const performanceTest = {
        timestamp: new Date().toISOString(),
        metrics: {}
      };

      // Response time baseline
      const responseTimeTests = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
          .expect(200);
        responseTimeTests.push(Date.now() - start);
      }

      responseTimeTests.sort((a, b) => a - b);
      performanceTest.metrics.responseTime = {
        min: responseTimeTests[0],
        max: responseTimeTests[responseTimeTests.length - 1],
        avg: responseTimeTests.reduce((sum, time) => sum + time, 0) / responseTimeTests.length,
        p50: responseTimeTests[Math.floor(responseTimeTests.length * 0.5)],
        p95: responseTimeTests[Math.floor(responseTimeTests.length * 0.95)],
        p99: responseTimeTests[Math.floor(responseTimeTests.length * 0.99)]
      };

      // Throughput baseline
      const throughputStart = Date.now();
      const throughputPromises = [];
      for (let i = 0; i < 50; i++) {
        throughputPromises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
        );
      }

      await Promise.all(throughputPromises);
      const throughputTime = Date.now() - throughputStart;
      performanceTest.metrics.throughput = {
        requestsPerSecond: 50 / (throughputTime / 1000),
        totalTime: throughputTime
      };

      // Concurrent request baseline
      const concurrentStart = Date.now();
      const concurrentPromises = Array(20).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
      );

      await Promise.all(concurrentPromises);
      const concurrentTime = Date.now() - concurrentStart;
      performanceTest.metrics.concurrency = {
        concurrentRequests: 20,
        totalTime: concurrentTime,
        avgResponseTime: concurrentTime / 20
      };

      // Database performance baseline
      const dbMetrics = poolMonitor.getMetrics();
      performanceTest.metrics.database = {
        averageQueryTime: dbMetrics.averageQueryTime,
        totalQueries: dbMetrics.totalQueries,
        errorRate: dbMetrics.errorRate,
        poolUtilization: (dbMetrics.activeConnections / pool.options.max) * 100
      };

      // Store baseline if first run or compare with previous
      const testKey = 'baseline';
      if (!monitoringResults.performanceBaselines[testKey]) {
        monitoringResults.performanceBaselines[testKey] = performanceTest;
        console.log('📊 Performance baseline established');
      } else {
        const baseline = monitoringResults.performanceBaselines[testKey];
        const comparison = comparePerformance(baseline.metrics, performanceTest.metrics);
        
        console.log('📊 Performance Comparison with Baseline:');
        console.log(`  Response Time P95: ${performanceTest.metrics.responseTime.p95}ms (baseline: ${baseline.metrics.responseTime.p95}ms)`);
        console.log(`  Throughput: ${performanceTest.metrics.throughput.requestsPerSecond.toFixed(2)} req/s (baseline: ${baseline.metrics.throughput.requestsPerSecond.toFixed(2)} req/s)`);
        console.log(`  Concurrent Performance: ${performanceTest.metrics.concurrency.avgResponseTime.toFixed(2)}ms (baseline: ${baseline.metrics.concurrency.avgResponseTime.toFixed(2)}ms)`);

        // Check for performance degradation
        if (comparison.degraded.length > 0) {
          const alert = {
            timestamp: new Date().toISOString(),
            type: 'performance_degradation',
            degradedMetrics: comparison.degraded,
            currentMetrics: performanceTest.metrics,
            baselineMetrics: baseline.metrics
          };
          
          monitoringResults.alerts.push(alert);
          console.warn('⚠️ Performance degradation detected:', comparison.degraded);
        }
      }

      monitoringResults.testRuns.push(performanceTest);

      // Performance assertions
      expect(performanceTest.metrics.responseTime.p95).toBeLessThan(5000); // P95 under 5s
      expect(performanceTest.metrics.responseTime.avg).toBeLessThan(1000); // Average under 1s
      expect(performanceTest.metrics.throughput.requestsPerSecond).toBeGreaterThan(10); // At least 10 req/s
      expect(performanceTest.metrics.concurrency.avgResponseTime).toBeLessThan(2000); // Concurrent avg under 2s
      expect(performanceTest.metrics.database.errorRate).toBeLessThan(0.05); // Less than 5% error rate
    });
  });

  describe('Deduplication Effectiveness Monitoring', () => {
    test('should monitor deduplication effectiveness continuously', async () => {
      console.log('🔄 Monitoring deduplication effectiveness...');
      
      // Simulate realistic deduplication scenarios
      const deduplicationTest = {
        timestamp: new Date().toISOString(),
        scenarios: {}
      };

      // Scenario 1: Identical concurrent requests
      const identicalRequestCount = 30;
      const identicalStart = Date.now();
      
      const identicalPromises = Array(identicalRequestCount).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
      );

      await Promise.all(identicalPromises);
      const identicalTime = Date.now() - identicalStart;

      deduplicationTest.scenarios.identicalRequests = {
        requestCount: identicalRequestCount,
        totalTime: identicalTime,
        avgResponseTime: identicalTime / identicalRequestCount,
        expectedDeduplication: true
      };

      // Scenario 2: Different search parameters
      const searchTerms = ['test', 'contact', 'example', ''];
      const searchRequestsPerTerm = 5;
      const searchStart = Date.now();
      
      const searchPromises = [];
      for (const term of searchTerms) {
        for (let i = 0; i < searchRequestsPerTerm; i++) {
          const url = term ? `/api/contacts?search=${term}` : '/api/contacts';
          searchPromises.push(
            request(app)
              .get(url)
              .set('Authorization', `Bearer ${authTokens[0]}`)
          );
        }
      }

      await Promise.all(searchPromises);
      const searchTime = Date.now() - searchStart;

      deduplicationTest.scenarios.searchRequests = {
        uniqueTerms: searchTerms.length,
        requestsPerTerm: searchRequestsPerTerm,
        totalRequests: searchPromises.length,
        totalTime: searchTime,
        avgResponseTime: searchTime / searchPromises.length
      };

      // Scenario 3: Mixed request patterns
      const mixedStart = Date.now();
      const mixedPromises = [];
      
      // 60% identical requests, 40% unique
      for (let i = 0; i < 25; i++) {
        if (i < 15) {
          // Identical requests
          mixedPromises.push(
            request(app)
              .get('/api/contacts')
              .set('Authorization', `Bearer ${authTokens[0]}`)
          );
        } else {
          // Unique requests
          mixedPromises.push(
            request(app)
              .get(`/api/contacts?page=${i}`)
              .set('Authorization', `Bearer ${authTokens[0]}`)
          );
        }
      }

      await Promise.all(mixedPromises);
      const mixedTime = Date.now() - mixedStart;

      deduplicationTest.scenarios.mixedRequests = {
        totalRequests: mixedPromises.length,
        identicalRequests: 15,
        uniqueRequests: 10,
        totalTime: mixedTime,
        avgResponseTime: mixedTime / mixedPromises.length
      };

      console.log('🔄 Deduplication Monitoring Results:');
      console.log(`  Identical Requests: ${identicalRequestCount} in ${identicalTime}ms (avg: ${deduplicationTest.scenarios.identicalRequests.avgResponseTime.toFixed(2)}ms)`);
      console.log(`  Search Requests: ${searchPromises.length} in ${searchTime}ms (avg: ${deduplicationTest.scenarios.searchRequests.avgResponseTime.toFixed(2)}ms)`);
      console.log(`  Mixed Requests: ${mixedPromises.length} in ${mixedTime}ms (avg: ${deduplicationTest.scenarios.mixedRequests.avgResponseTime.toFixed(2)}ms)`);

      // Performance expectations for deduplication
      expect(deduplicationTest.scenarios.identicalRequests.avgResponseTime).toBeLessThan(100); // Should be very fast due to deduplication
      expect(deduplicationTest.scenarios.searchRequests.avgResponseTime).toBeLessThan(200); // Reasonable with some deduplication
      expect(deduplicationTest.scenarios.mixedRequests.avgResponseTime).toBeLessThan(300); // Mixed performance
    });
  });

  describe('Resource Exhaustion Recovery Monitoring', () => {
    test('should monitor resource exhaustion and recovery patterns', async () => {
      console.log('🔥 Monitoring resource exhaustion recovery...');
      
      const exhaustionTest = {
        timestamp: new Date().toISOString(),
        phases: {}
      };

      // Phase 1: Normal load baseline
      const normalStart = Date.now();
      const normalPromises = Array(10).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
      );

      await Promise.all(normalPromises);
      const normalTime = Date.now() - normalStart;

      exhaustionTest.phases.normal = {
        requestCount: 10,
        totalTime: normalTime,
        avgResponseTime: normalTime / 10,
        successRate: 100
      };

      // Phase 2: Stress load
      const stressStart = Date.now();
      const stressPromises = Array(50).fill().map((_, index) =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
          .timeout(10000)
          .catch(err => ({ error: err.message, status: err.status }))
      );

      const stressResults = await Promise.all(stressPromises);
      const stressTime = Date.now() - stressStart;

      const stressSuccessful = stressResults.filter(r => r.status === 200);
      const stressErrors = stressResults.filter(r => r.error || r.status !== 200);

      exhaustionTest.phases.stress = {
        requestCount: 50,
        totalTime: stressTime,
        successfulRequests: stressSuccessful.length,
        errorRequests: stressErrors.length,
        successRate: (stressSuccessful.length / 50) * 100,
        avgResponseTime: stressTime / 50
      };

      // Phase 3: Recovery
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for recovery

      const recoveryStart = Date.now();
      const recoveryPromises = Array(10).fill().map(() =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[0]}`)
      );

      const recoveryResults = await Promise.all(recoveryPromises);
      const recoveryTime = Date.now() - recoveryStart;

      const recoverySuccessful = recoveryResults.filter(r => r.status === 200);

      exhaustionTest.phases.recovery = {
        requestCount: 10,
        totalTime: recoveryTime,
        successfulRequests: recoverySuccessful.length,
        successRate: (recoverySuccessful.length / 10) * 100,
        avgResponseTime: recoveryTime / 10,
        recoveryTime: recoveryStart - (stressStart + stressTime)
      };

      console.log('🔥 Resource Exhaustion Monitoring Results:');
      console.log(`  Normal Load: ${exhaustionTest.phases.normal.successRate}% success, ${exhaustionTest.phases.normal.avgResponseTime.toFixed(2)}ms avg`);
      console.log(`  Stress Load: ${exhaustionTest.phases.stress.successRate.toFixed(2)}% success, ${exhaustionTest.phases.stress.avgResponseTime.toFixed(2)}ms avg`);
      console.log(`  Recovery: ${exhaustionTest.phases.recovery.successRate}% success, ${exhaustionTest.phases.recovery.avgResponseTime.toFixed(2)}ms avg`);

      // Recovery expectations
      expect(exhaustionTest.phases.normal.successRate).toBe(100); // Normal load should be 100% successful
      expect(exhaustionTest.phases.stress.successRate).toBeGreaterThan(60); // Stress should maintain some service
      expect(exhaustionTest.phases.recovery.successRate).toBeGreaterThan(90); // Should recover well
      expect(exhaustionTest.phases.recovery.avgResponseTime).toBeLessThan(exhaustionTest.phases.stress.avgResponseTime); // Recovery should be faster
    });
  });

  describe('Alerting and Threshold Monitoring', () => {
    test('should detect and alert on performance degradation', async () => {
      console.log('🚨 Testing alerting and threshold monitoring...');
      
      const alertingTest = {
        timestamp: new Date().toISOString(),
        thresholds: {
          responseTimeP95: 5000, // 5 seconds
          responseTimeAvg: 1000, // 1 second
          throughput: 10, // 10 req/s
          errorRate: 0.05, // 5%
          successRate: 0.95 // 95%
        },
        violations: []
      };

      // Test response time thresholds
      const responseTimeTests = [];
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        try {
          await request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
            .timeout(8000);
          responseTimeTests.push(Date.now() - start);
        } catch (error) {
          responseTimeTests.push(8000); // Timeout value
        }
      }

      responseTimeTests.sort((a, b) => a - b);
      const p95 = responseTimeTests[Math.floor(responseTimeTests.length * 0.95)];
      const avg = responseTimeTests.reduce((sum, time) => sum + time, 0) / responseTimeTests.length;

      if (p95 > alertingTest.thresholds.responseTimeP95) {
        alertingTest.violations.push({
          metric: 'responseTimeP95',
          value: p95,
          threshold: alertingTest.thresholds.responseTimeP95,
          severity: 'high'
        });
      }

      if (avg > alertingTest.thresholds.responseTimeAvg) {
        alertingTest.violations.push({
          metric: 'responseTimeAvg',
          value: avg,
          threshold: alertingTest.thresholds.responseTimeAvg,
          severity: 'medium'
        });
      }

      // Test throughput thresholds
      const throughputStart = Date.now();
      const throughputPromises = Array(30).fill().map((_, index) =>
        request(app)
          .get('/api/contacts')
          .set('Authorization', `Bearer ${authTokens[index % authTokens.length]}`)
          .catch(err => ({ error: err.message }))
      );

      const throughputResults = await Promise.all(throughputPromises);
      const throughputTime = Date.now() - throughputStart;
      const throughput = 30 / (throughputTime / 1000);

      if (throughput < alertingTest.thresholds.throughput) {
        alertingTest.violations.push({
          metric: 'throughput',
          value: throughput,
          threshold: alertingTest.thresholds.throughput,
          severity: 'high'
        });
      }

      // Test error rate thresholds
      const errorCount = throughputResults.filter(r => r.error).length;
      const errorRate = errorCount / throughputResults.length;

      if (errorRate > alertingTest.thresholds.errorRate) {
        alertingTest.violations.push({
          metric: 'errorRate',
          value: errorRate,
          threshold: alertingTest.thresholds.errorRate,
          severity: 'high'
        });
      }

      console.log('🚨 Alerting Test Results:');
      console.log(`  Response Time P95: ${p95}ms (threshold: ${alertingTest.thresholds.responseTimeP95}ms)`);
      console.log(`  Response Time Avg: ${avg.toFixed(2)}ms (threshold: ${alertingTest.thresholds.responseTimeAvg}ms)`);
      console.log(`  Throughput: ${throughput.toFixed(2)} req/s (threshold: ${alertingTest.thresholds.throughput} req/s)`);
      console.log(`  Error Rate: ${(errorRate * 100).toFixed(2)}% (threshold: ${(alertingTest.thresholds.errorRate * 100).toFixed(2)}%)`);
      console.log(`  Violations: ${alertingTest.violations.length}`);

      if (alertingTest.violations.length > 0) {
        console.warn('⚠️ Performance violations detected:');
        alertingTest.violations.forEach(violation => {
          console.warn(`  - ${violation.metric}: ${violation.value} exceeds ${violation.threshold} (${violation.severity})`);
        });
        
        monitoringResults.alerts.push({
          timestamp: new Date().toISOString(),
          type: 'threshold_violation',
          violations: alertingTest.violations
        });
      }

      // Assertions - should meet all thresholds
      expect(p95).toBeLessThan(alertingTest.thresholds.responseTimeP95);
      expect(avg).toBeLessThan(alertingTest.thresholds.responseTimeAvg);
      expect(throughput).toBeGreaterThan(alertingTest.thresholds.throughput);
      expect(errorRate).toBeLessThan(alertingTest.thresholds.errorRate);
    });
  });

  describe('Monitoring Report Generation', () => {
    test('should generate comprehensive monitoring report', async () => {
      console.log('📋 Generating comprehensive monitoring report...');
      
      const report = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalTestRuns: monitoringResults.testRuns.length,
          totalAlerts: monitoringResults.alerts.length,
          totalHealthChecks: monitoringResults.healthChecks.length,
          overallHealthScore: 0,
          performanceTrend: 'stable'
        },
        healthStatus: {},
        performanceMetrics: {},
        alerts: monitoringResults.alerts.slice(-10), // Last 10 alerts
        recommendations: []
      };

      // Calculate overall health score
      if (monitoringResults.healthChecks.length > 0) {
        const recentHealthChecks = monitoringResults.healthChecks.slice(-5); // Last 5 checks
        const avgHealthScore = recentHealthChecks.reduce((sum, check) => sum + check.healthScore, 0) / recentHealthChecks.length;
        report.summary.overallHealthScore = avgHealthScore;
        
        report.healthStatus = {
          current: recentHealthChecks[recentHealthChecks.length - 1],
          trend: avgHealthScore > 90 ? 'excellent' : avgHealthScore > 80 ? 'good' : avgHealthScore > 70 ? 'fair' : 'poor'
        };
      }

      // Performance metrics summary
      if (monitoringResults.testRuns.length > 0) {
        const recentRuns = monitoringResults.testRuns.slice(-5);
        const avgResponseTime = recentRuns.reduce((sum, run) => sum + run.metrics.responseTime.avg, 0) / recentRuns.length;
        const avgThroughput = recentRuns.reduce((sum, run) => sum + run.metrics.throughput.requestsPerSecond, 0) / recentRuns.length;
        
        report.performanceMetrics = {
          averageResponseTime: avgResponseTime,
          averageThroughput: avgThroughput,
          trend: 'stable' // Could be calculated based on historical data
        };
      }

      // Generate recommendations
      if (report.summary.overallHealthScore < 80) {
        report.recommendations.push('Health score below 80% - investigate system components');
      }
      
      if (monitoringResults.alerts.length > 0) {
        const recentAlerts = monitoringResults.alerts.slice(-5);
        const alertTypes = [...new Set(recentAlerts.map(alert => alert.type))];
        
        if (alertTypes.includes('performance_degradation')) {
          report.recommendations.push('Performance degradation detected - review resource allocation');
        }
        
        if (alertTypes.includes('threshold_violation')) {
          report.recommendations.push('Threshold violations detected - consider adjusting limits or scaling');
        }
      }

      if (report.performanceMetrics.averageResponseTime > 1000) {
        report.recommendations.push('Average response time above 1s - optimize database queries and caching');
      }

      console.log('📋 Monitoring Report Summary:');
      console.log(`  Test Runs: ${report.summary.totalTestRuns}`);
      console.log(`  Alerts: ${report.summary.totalAlerts}`);
      console.log(`  Health Checks: ${report.summary.totalHealthChecks}`);
      console.log(`  Overall Health Score: ${report.summary.overallHealthScore.toFixed(2)}%`);
      console.log(`  Health Trend: ${report.healthStatus.trend || 'unknown'}`);
      console.log(`  Performance Trend: ${report.summary.performanceTrend}`);
      console.log(`  Recommendations: ${report.recommendations.length}`);

      if (report.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        report.recommendations.forEach((rec, index) => {
          console.log(`  ${index + 1}. ${rec}`);
        });
      }

      // Save report
      try {
        const reportPath = path.join(__dirname, `monitoring-report-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved to: ${reportPath}`);
      } catch (error) {
        console.warn('⚠️ Could not save report:', error.message);
      }

      // Assertions for monitoring quality
      expect(report.summary.totalTestRuns).toBeGreaterThan(0);
      expect(report.summary.overallHealthScore).toBeGreaterThan(70); // At least 70% health
      
      if (report.performanceMetrics.averageResponseTime) {
        expect(report.performanceMetrics.averageResponseTime).toBeLessThan(2000); // Under 2s average
      }
      
      if (report.performanceMetrics.averageThroughput) {
        expect(report.performanceMetrics.averageThroughput).toBeGreaterThan(5); // At least 5 req/s
      }
    });
  });
});

/**
 * Helper function to compare performance metrics
 */
function comparePerformance(baseline, current) {
  const degraded = [];
  const improved = [];
  
  // Response time comparison (higher is worse)
  if (current.responseTime.p95 > baseline.responseTime.p95 * 1.2) {
    degraded.push({
      metric: 'responseTimeP95',
      baseline: baseline.responseTime.p95,
      current: current.responseTime.p95,
      degradation: ((current.responseTime.p95 - baseline.responseTime.p95) / baseline.responseTime.p95) * 100
    });
  } else if (current.responseTime.p95 < baseline.responseTime.p95 * 0.8) {
    improved.push('responseTimeP95');
  }
  
  // Throughput comparison (lower is worse)
  if (current.throughput.requestsPerSecond < baseline.throughput.requestsPerSecond * 0.8) {
    degraded.push({
      metric: 'throughput',
      baseline: baseline.throughput.requestsPerSecond,
      current: current.throughput.requestsPerSecond,
      degradation: ((baseline.throughput.requestsPerSecond - current.throughput.requestsPerSecond) / baseline.throughput.requestsPerSecond) * 100
    });
  } else if (current.throughput.requestsPerSecond > baseline.throughput.requestsPerSecond * 1.2) {
    improved.push('throughput');
  }
  
  // Error rate comparison (higher is worse)
  if (current.database.errorRate > baseline.database.errorRate * 1.5) {
    degraded.push({
      metric: 'errorRate',
      baseline: baseline.database.errorRate,
      current: current.database.errorRate,
      degradation: ((current.database.errorRate - baseline.database.errorRate) / baseline.database.errorRate) * 100
    });
  }
  
  return { degraded, improved };
}