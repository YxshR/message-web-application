// Artillery.js processor for API Reliability Load Testing
// Handles test setup, user management, and custom metrics collection

const { Client } = require('socket.io-client');

module.exports = {
  setupTestEnvironment,
  setupUser,
  trackDeduplicationMetrics,
  trackConnectionPoolMetrics,
  trackRetryMetrics,
  measureRecoveryTime,
  validateApiReliability,
  cleanupTestData
};

// Global state for tracking metrics
let testMetrics = {
  deduplicationHits: 0,
  totalRequests: 0,
  retryAttempts: 0,
  successfulRetries: 0,
  connectionPoolErrors: 0,
  resourceExhaustionStart: null,
  resourceExhaustionEnd: null
};

let testUsers = [];
let createdContacts = [];

/**
 * Setup test environment before load testing begins
 */
async function setupTestEnvironment(context, events, done) {
  console.log('🚀 Setting up API Reliability Load Test Environment...');
  
  try {
    // Create test users if they don't exist
    const users = [
      { email: "loadtest1@example.com", password: "password123", name: "Load Test User 1" },
      { email: "loadtest2@example.com", password: "password123", name: "Load Test User 2" },
      { email: "loadtest3@example.com", password: "password123", name: "Load Test User 3" },
      { email: "loadtest4@example.com", password: "password123", name: "Load Test User 4" },
      { email: "loadtest5@example.com", password: "password123", name: "Load Test User 5" }
    ];

    for (const user of users) {
      try {
        // Try to register user (will fail if already exists, which is fine)
        const response = await fetch(`${context.vars.target}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user)
        });
        
        if (response.ok) {
          const userData = await response.json();
          testUsers.push(userData.user);
          console.log(`✅ Created test user: ${user.email}`);
        } else if (response.status === 409) {
          // User already exists, try to login to get user data
          const loginResponse = await fetch(`${context.vars.target}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, password: user.password })
          });
          
          if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            testUsers.push(loginData.user);
            console.log(`✅ Using existing test user: ${user.email}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not setup user ${user.email}:`, error.message);
      }
    }

    // Create some initial contacts for testing
    if (testUsers.length >= 2) {
      try {
        const loginResponse = await fetch(`${context.vars.target}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: testUsers[0].email, 
            password: "password123" 
          })
        });

        if (loginResponse.ok) {
          const { token } = await loginResponse.json();
          
          // Create test contacts
          for (let i = 1; i <= 10; i++) {
            const contactResponse = await fetch(`${context.vars.target}/api/contacts`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                name: `Test Contact ${i}`,
                email: `testcontact${i}@example.com`
              })
            });

            if (contactResponse.ok) {
              const contact = await contactResponse.json();
              createdContacts.push(contact);
            }
          }
          
          console.log(`✅ Created ${createdContacts.length} test contacts`);
        }
      } catch (error) {
        console.warn('⚠️ Could not create test contacts:', error.message);
      }
    }

    // Initialize metrics tracking
    testMetrics = {
      deduplicationHits: 0,
      totalRequests: 0,
      retryAttempts: 0,
      successfulRetries: 0,
      connectionPoolErrors: 0,
      resourceExhaustionStart: null,
      resourceExhaustionEnd: null
    };

    console.log('✅ Test environment setup complete');
    console.log(`📊 Test users: ${testUsers.length}, Test contacts: ${createdContacts.length}`);
    
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
  }
  
  return done();
}

/**
 * Setup user context for each virtual user
 */
function setupUser(context, events, done) {
  // Assign a random user from the test user pool
  const user = context.vars.testUsers[Math.floor(Math.random() * context.vars.testUsers.length)];
  context.vars.user = user;
  
  // Track request for deduplication metrics
  testMetrics.totalRequests++;
  
  return done();
}

/**
 * Track deduplication effectiveness
 */
function trackDeduplicationMetrics(requestParams, response, context, ee, next) {
  // Check for deduplication headers or response patterns
  if (response.headers['x-cache-hit'] || 
      response.headers['x-deduplication-hit'] ||
      (response.statusCode === 200 && response.body && 
       JSON.stringify(response.body).includes('cached'))) {
    testMetrics.deduplicationHits++;
  }

  // Calculate and emit deduplication effectiveness
  const effectiveness = (testMetrics.deduplicationHits / testMetrics.totalRequests) * 100;
  ee.emit('customStat', 'deduplication_effectiveness', effectiveness);
  
  return next();
}

/**
 * Track connection pool utilization and errors
 */
function trackConnectionPoolMetrics(requestParams, response, context, ee, next) {
  // Track connection pool related errors
  if (response.statusCode === 503 || 
      (response.body && JSON.stringify(response.body).includes('ERR_INSUFFICIENT_RESOURCES'))) {
    testMetrics.connectionPoolErrors++;
    
    // Mark start of resource exhaustion if not already marked
    if (!testMetrics.resourceExhaustionStart) {
      testMetrics.resourceExhaustionStart = Date.now();
    }
  } else if (testMetrics.resourceExhaustionStart && !testMetrics.resourceExhaustionEnd) {
    // Mark end of resource exhaustion on first successful response
    testMetrics.resourceExhaustionEnd = Date.now();
  }

  // Emit connection pool utilization (estimated based on errors)
  const errorRate = (testMetrics.connectionPoolErrors / testMetrics.totalRequests) * 100;
  const utilization = Math.min(errorRate * 5, 100); // Rough estimation
  ee.emit('customStat', 'connection_pool_utilization', utilization);
  
  return next();
}

/**
 * Track retry mechanism effectiveness
 */
function trackRetryMetrics(requestParams, response, context, ee, next) {
  // Check for retry indicators in headers
  if (response.headers['x-retry-count']) {
    testMetrics.retryAttempts++;
    
    if (response.statusCode === 200) {
      testMetrics.successfulRetries++;
    }
  }

  // Calculate retry success rate
  const retrySuccessRate = testMetrics.retryAttempts > 0 ? 
    (testMetrics.successfulRetries / testMetrics.retryAttempts) * 100 : 100;
  
  ee.emit('customStat', 'retry_success_rate', retrySuccessRate);
  
  return next();
}

/**
 * Measure resource exhaustion recovery time
 */
function measureRecoveryTime(requestParams, response, context, ee, next) {
  if (testMetrics.resourceExhaustionStart && testMetrics.resourceExhaustionEnd) {
    const recoveryTime = testMetrics.resourceExhaustionEnd - testMetrics.resourceExhaustionStart;
    ee.emit('customStat', 'resource_exhaustion_recovery_time', recoveryTime);
    
    // Reset for next measurement
    testMetrics.resourceExhaustionStart = null;
    testMetrics.resourceExhaustionEnd = null;
  }
  
  return next();
}

/**
 * Validate API reliability responses
 */
function validateApiReliability(requestParams, response, context, ee, next) {
  const startTime = Date.now();
  
  try {
    // Validate response structure for contacts endpoint
    if (requestParams.url.includes('/api/contacts') && response.statusCode === 200) {
      const data = JSON.parse(response.body);
      
      if (!data.success || !Array.isArray(data.contacts)) {
        console.error('❌ Invalid contacts response structure:', data);
        ee.emit('customStat', 'validation_errors', 1);
      }
    }
    
    // Validate error responses have proper structure
    if (response.statusCode >= 400) {
      try {
        const errorData = JSON.parse(response.body);
        
        if (!errorData.error && !errorData.message) {
          console.error('❌ Invalid error response structure:', errorData);
          ee.emit('customStat', 'validation_errors', 1);
        }
        
        // Check for proper error codes
        if (response.statusCode === 503 && 
            !errorData.message.includes('resource') && 
            !errorData.message.includes('capacity')) {
          console.warn('⚠️ 503 error without resource exhaustion message');
        }
        
      } catch (parseError) {
        console.error('❌ Could not parse error response:', response.body);
        ee.emit('customStat', 'validation_errors', 1);
      }
    }
    
    // Track response times for performance validation
    const responseTime = Date.now() - startTime;
    if (responseTime > 10000) { // 10 second threshold
      console.warn(`⚠️ Slow response detected: ${responseTime}ms for ${requestParams.url}`);
      ee.emit('customStat', 'slow_responses', 1);
    }
    
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    ee.emit('customStat', 'validation_errors', 1);
  }
  
  return next();
}

/**
 * Cleanup test data after load testing
 */
async function cleanupTestData(context, events, done) {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Login as first test user to cleanup
    if (testUsers.length > 0) {
      const loginResponse = await fetch(`${context.vars.target}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: testUsers[0].email, 
          password: "password123" 
        })
      });

      if (loginResponse.ok) {
        const { token } = await loginResponse.json();
        
        // Delete created contacts
        for (const contact of createdContacts) {
          try {
            await fetch(`${context.vars.target}/api/contacts/${contact.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } catch (error) {
            console.warn(`⚠️ Could not delete contact ${contact.id}:`, error.message);
          }
        }
        
        console.log(`✅ Cleaned up ${createdContacts.length} test contacts`);
      }
    }
    
    // Print final metrics summary
    console.log('\n📊 Final Load Test Metrics:');
    console.log(`Total Requests: ${testMetrics.totalRequests}`);
    console.log(`Deduplication Hits: ${testMetrics.deduplicationHits}`);
    console.log(`Deduplication Effectiveness: ${((testMetrics.deduplicationHits / testMetrics.totalRequests) * 100).toFixed(2)}%`);
    console.log(`Connection Pool Errors: ${testMetrics.connectionPoolErrors}`);
    console.log(`Retry Attempts: ${testMetrics.retryAttempts}`);
    console.log(`Successful Retries: ${testMetrics.successfulRetries}`);
    
    if (testMetrics.retryAttempts > 0) {
      console.log(`Retry Success Rate: ${((testMetrics.successfulRetries / testMetrics.retryAttempts) * 100).toFixed(2)}%`);
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
  
  return done();
}

// Helper function to generate random test data
function generateRandomMessage() {
  const messages = [
    'Load test message',
    'Performance testing in progress',
    'Concurrent request simulation',
    'Resource exhaustion test',
    'Connection pool stress test'
  ];
  
  return messages[Math.floor(Math.random() * messages.length)] + 
         ` ${Math.random().toString(36).substring(7)} at ${new Date().toISOString()}`;
}

// Helper function to simulate network delays
function simulateNetworkDelay(min = 10, max = 100) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Export helper functions for use in scenarios
module.exports.generateRandomMessage = generateRandomMessage;
module.exports.simulateNetworkDelay = simulateNetworkDelay;