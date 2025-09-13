const ResourceMonitor = require('./resourceMonitor');

/**
 * Demonstration script for the ResourceMonitor functionality
 * This shows how the monitoring system works in practice
 */
async function demonstrateResourceMonitoring() {
  console.log('🚀 Starting Resource Monitoring Demonstration\n');

  // Initialize the monitor
  const monitor = new ResourceMonitor({
    metricsRetentionMs: 60000, // 1 minute
    alertCooldownMs: 2000, // 2 seconds
    alertThresholds: {
      maxActiveConnections: 5,
      maxQueuedRequests: 10,
      maxResponseTime: 1000,
      maxErrorRate: 0.1,
      minThroughput: 2
    }
  });

  // Set up alert listener
  monitor.onAlert((alert) => {
    console.log(`🚨 ALERT [${alert.severity}]: ${alert.message}`);
  });

  console.log('📊 Simulating API requests...\n');

  // Simulate various API requests
  const endpoints = ['/api/contacts', '/api/users', '/api/messages'];
  
  // Generate normal requests
  for (let i = 0; i < 20; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const responseTime = Math.random() * 800 + 100; // 100-900ms
    const success = Math.random() > 0.05; // 95% success rate
    
    monitor.trackRequest(endpoint, responseTime, success);
    
    if (i % 5 === 0) {
      console.log(`✅ Processed ${i + 1} requests`);
    }
  }

  // Show current metrics
  console.log('\n📈 Current Metrics:');
  const metrics = monitor.getMetrics();
  console.log(`- Total Requests: ${metrics.requests.total}`);
  console.log(`- Success Rate: ${((1 - metrics.requests.errorRate) * 100).toFixed(1)}%`);
  console.log(`- Average Response Time: ${metrics.performance.averageResponseTime.toFixed(1)}ms`);
  console.log(`- Throughput: ${metrics.performance.throughput.toFixed(2)} req/s`);

  // Simulate connection pool activity
  console.log('\n🔗 Simulating connection pool activity...');
  monitor.updateConnectionPoolMetrics({
    active: 3,
    idle: 2,
    total: 5,
    queued: 0
  });

  // Simulate high error rate to trigger alert
  console.log('\n⚠️  Simulating high error rate...');
  for (let i = 0; i < 10; i++) {
    monitor.trackRequest('/api/failing-endpoint', 500, false);
  }

  // Simulate high response times
  console.log('\n🐌 Simulating slow responses...');
  for (let i = 0; i < 5; i++) {
    monitor.trackRequest('/api/slow-endpoint', 2000, true);
  }

  // Simulate connection pool stress
  console.log('\n🔥 Simulating connection pool stress...');
  monitor.updateConnectionPoolMetrics({
    active: 8, // Above threshold
    idle: 0,
    total: 8,
    queued: 15 // Above threshold
  });

  // Wait a moment for alerts to process
  await new Promise(resolve => setTimeout(resolve, 100));

  // Show final metrics
  console.log('\n📊 Final Metrics:');
  const finalMetrics = monitor.getMetrics();
  console.log(`- Total Requests: ${finalMetrics.requests.total}`);
  console.log(`- Error Rate: ${(finalMetrics.requests.errorRate * 100).toFixed(1)}%`);
  console.log(`- Average Response Time: ${finalMetrics.performance.averageResponseTime.toFixed(1)}ms`);
  console.log(`- P95 Response Time: ${finalMetrics.performance.p95ResponseTime.toFixed(1)}ms`);
  console.log(`- Active Alerts: ${finalMetrics.alerts.length}`);

  // Show resource usage summary
  console.log('\n💾 Resource Usage Summary:');
  const usage = monitor.getResourceUsage();
  console.log(`- Connection Pool Active: ${usage.connectionPool.active}`);
  console.log(`- Connection Pool Queued: ${usage.connectionPool.queued}`);
  console.log(`- Health Status: ${usage.health.activeAlerts > 0 ? '⚠️  Degraded' : '✅ Healthy'}`);

  // Show recent alerts
  const recentAlerts = monitor.getRecentAlerts();
  if (recentAlerts.length > 0) {
    console.log('\n🚨 Recent Alerts:');
    recentAlerts.forEach((alert, index) => {
      console.log(`${index + 1}. [${alert.severity}] ${alert.type}: ${alert.message}`);
    });
  }

  // Cleanup
  monitor.destroy();
  console.log('\n✅ Demonstration completed successfully!');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateResourceMonitoring().catch(console.error);
}

module.exports = { demonstrateResourceMonitoring };