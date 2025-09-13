const { Pool } = require('pg');
require('dotenv').config();

// Enhanced connection pool configuration based on API reliability requirements
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'messaging_app',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Enhanced connection pool settings for reliability
  max: parseInt(process.env.DB_POOL_MAX) || 20,           // Maximum connections
  min: parseInt(process.env.DB_POOL_MIN) || 5,            // Minimum connections to maintain
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,  // Wait up to 60s for connection
  createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 30000,    // 30s to create new connection
  destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,   // 5s to destroy connection
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 600000,       // 10 minutes idle timeout
  reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL) || 1000,       // Check for idle connections every 1s
  createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL) || 200, // Retry connection creation every 200ms
  propagateCreateError: false, // Don't immediately fail on connection creation errors
  
  // Additional reliability settings
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,   // 30s query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,           // 30s query timeout
  application_name: 'messaging_app_backend'
};

// Connection pool monitoring and metrics
class ConnectionPoolMonitor {
  constructor() {
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      totalErrors: 0,
      averageQueryTime: 0,
      lastResetTime: Date.now()
    };
    this.queryTimes = [];
    this.maxQueryTimeHistory = 1000; // Keep last 1000 query times for average calculation
  }

  updateMetrics(pool) {
    this.metrics.totalConnections = pool.totalCount;
    this.metrics.idleConnections = pool.idleCount;
    this.metrics.waitingClients = pool.waitingCount;
  }

  recordQuery(duration, success = true) {
    this.metrics.totalQueries++;
    if (!success) {
      this.metrics.totalErrors++;
    }
    
    this.queryTimes.push(duration);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes.shift();
    }
    
    this.metrics.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      errorRate: this.metrics.totalQueries > 0 ? this.metrics.totalErrors / this.metrics.totalQueries : 0,
      uptime: Date.now() - this.metrics.lastResetTime
    };
  }

  reset() {
    this.metrics = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      totalErrors: 0,
      averageQueryTime: 0,
      lastResetTime: Date.now()
    };
    this.queryTimes = [];
  }
}

// Initialize pool monitor
const poolMonitor = new ConnectionPoolMonitor();

// Use DATABASE_URL if provided (for production environments like Heroku)
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL, 
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      ...dbConfig
    })
  : new Pool(dbConfig);

// Enhanced error handling with logging and monitoring
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    poolStats: {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    }
  });
  
  // Don't exit process immediately - let the application handle the error gracefully
  poolMonitor.recordQuery(0, false);
});

// Monitor pool events
pool.on('connect', (client) => {
  console.log('New client connected to database');
  poolMonitor.updateMetrics(pool);
});

pool.on('acquire', (client) => {
  poolMonitor.updateMetrics(pool);
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
  poolMonitor.updateMetrics(pool);
});

// Request queue for when pool is at capacity
class RequestQueue {
  constructor(maxSize = 100) {
    this.queue = [];
    this.maxSize = maxSize;
    this.processing = false;
  }

  async enqueue(requestFn, priority = 0) {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxSize) {
        reject(new Error('Request queue is full. Please try again later.'));
        return;
      }

      this.queue.push({
        requestFn,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      
      try {
        // Check if request has timed out (30 seconds)
        if (Date.now() - request.timestamp > 30000) {
          request.reject(new Error('Request timed out in queue'));
          continue;
        }

        const result = await request.requestFn();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    this.processing = false;
  }

  getQueueSize() {
    return this.queue.length;
  }

  clear() {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

const requestQueue = new RequestQueue();

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    return false;
  }
};

// Enhanced query helper function with connection pool management
const query = async (text, params, options = {}) => {
  const start = Date.now();
  const { priority = 0, timeout = 30000 } = options;
  
  try {
    // Check if pool is at capacity and queue the request if needed
    if (pool.waitingCount > 0 && pool.totalCount >= pool.options.max) {
      console.log('Pool at capacity, queuing request', {
        waitingCount: pool.waitingCount,
        totalConnections: pool.totalCount,
        maxConnections: pool.options.max
      });
      
      return await requestQueue.enqueue(async () => {
        return await executeQuery(text, params, start, timeout);
      }, priority);
    }
    
    return await executeQuery(text, params, start, timeout);
  } catch (err) {
    const duration = Date.now() - start;
    poolMonitor.recordQuery(duration, false);
    
    console.error('Query error:', {
      error: err.message,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
    // Handle specific error types
    if (err.code === 'ECONNREFUSED') {
      throw new Error('Database connection refused. Please check database server.');
    } else if (err.code === 'ETIMEDOUT') {
      throw new Error('Database query timed out. Please try again.');
    } else if (err.message.includes('pool is draining')) {
      throw new Error('Database is shutting down. Please try again later.');
    }
    
    throw err;
  }
};

// Internal query execution function
const executeQuery = async (text, params, startTime, timeout) => {
  const client = await pool.connect();
  
  try {
    // Set query timeout
    if (timeout) {
      await client.query(`SET statement_timeout = ${timeout}`);
    }
    
    const res = await client.query(text, params);
    const duration = Date.now() - startTime;
    
    poolMonitor.recordQuery(duration, true);
    
    console.log('Executed query', { 
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration, 
      rows: res.rowCount,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
    return res;
  } finally {
    client.release();
  }
};

// Enhanced transaction helper with timeout and monitoring
const transaction = async (callback, options = {}) => {
  const { timeout = 30000, priority = 1 } = options; // Transactions get higher priority
  const start = Date.now();
  
  // If pool is at capacity, queue the transaction
  if (pool.waitingCount > 0 && pool.totalCount >= pool.options.max) {
    return await requestQueue.enqueue(async () => {
      return await executeTransaction(callback, timeout, start);
    }, priority);
  }
  
  return await executeTransaction(callback, timeout, start);
};

// Internal transaction execution function
const executeTransaction = async (callback, timeout, startTime) => {
  const client = await pool.connect();
  
  try {
    // Set transaction timeout
    if (timeout) {
      await client.query(`SET statement_timeout = ${timeout}`);
    }
    
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    const duration = Date.now() - startTime;
    poolMonitor.recordQuery(duration, true);
    
    console.log('Transaction completed', {
      duration,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    const duration = Date.now() - startTime;
    poolMonitor.recordQuery(duration, false);
    
    console.error('Transaction failed:', {
      error: err.message,
      duration,
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    });
    
    throw err;
  } finally {
    client.release();
  }
};

// Graceful shutdown function
const gracefulShutdown = async () => {
  console.log('Initiating graceful database shutdown...');
  
  try {
    // Clear the request queue
    requestQueue.clear();
    
    // Wait for active queries to complete (max 30 seconds)
    const shutdownTimeout = 30000;
    const shutdownStart = Date.now();
    
    while (pool.totalCount > pool.idleCount && (Date.now() - shutdownStart) < shutdownTimeout) {
      console.log(`Waiting for ${pool.totalCount - pool.idleCount} active connections to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // End the pool
    await pool.end();
    console.log('Database pool closed successfully');
    
    return true;
  } catch (err) {
    console.error('Error during graceful shutdown:', err.message);
    return false;
  }
};

// Health check function with detailed pool information
const getPoolHealth = () => {
  const metrics = poolMonitor.getMetrics();
  const poolStats = {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    queueSize: requestQueue.getQueueSize()
  };
  
  const health = {
    status: 'healthy',
    pool: poolStats,
    metrics,
    timestamp: new Date().toISOString()
  };
  
  // Determine health status
  if (poolStats.waitingClients > 10) {
    health.status = 'degraded';
    health.warning = 'High number of waiting clients';
  }
  
  if (metrics.errorRate > 0.1) {
    health.status = 'unhealthy';
    health.error = 'High error rate detected';
  }
  
  if (poolStats.queueSize > 50) {
    health.status = 'critical';
    health.error = 'Request queue is nearly full';
  }
  
  return health;
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  gracefulShutdown,
  getPoolHealth,
  poolMonitor,
  requestQueue
};