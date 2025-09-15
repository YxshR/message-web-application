const { PrismaClient } = require('@prisma/client');

// Create a single instance of Prisma Client
let prisma;

/**
 * Get or create Prisma client instance with connection pooling and optimization
 * @returns {PrismaClient} Prisma client instance
 */
function getPrismaClient() {
  if (!prisma) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    prisma = new PrismaClient({
      log: isProduction ? ['error'] : ['info', 'warn', 'error'],
      errorFormat: 'pretty',
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });

    // Add connection retry logic
    const originalConnect = prisma.$connect.bind(prisma);
    prisma.$connect = async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          await originalConnect();
          return;
        } catch (error) {
          console.warn(`Database connection attempt failed, ${retries - 1} retries left:`, error.message);
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
  }
  return prisma;
}

/**
 * Connect to the database
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log('✅ Database disconnected successfully');
    }
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
async function testDatabaseConnection() {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
}

/**
 * Ensure database connection is active, reconnect if needed
 * @returns {Promise<PrismaClient>}
 */
async function ensureConnection() {
  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    return client;
  } catch (error) {
    console.warn('Database connection lost, attempting to reconnect...');
    
    // Reset the prisma instance to force reconnection
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.warn('Error during disconnect:', disconnectError.message);
      }
      prisma = null;
    }
    
    // Get a new client and connect
    const newClient = getPrismaClient();
    await newClient.$connect();
    return newClient;
  }
}

/**
 * Handle database errors with proper formatting
 * @param {Error} error - The database error
 * @returns {Object} Formatted error object
 */
function handleDatabaseError(error) {
  console.error('Database Error:', error);

  // Prisma specific error handling
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        return {
          type: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this information already exists',
          field: error.meta?.target?.[0] || 'unknown'
        };
      case 'P2025':
        return {
          type: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found'
        };
      case 'P2003':
        return {
          type: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          message: 'Invalid reference to related record'
        };
      case 'P2014':
        return {
          type: 'INVALID_ID',
          message: 'The provided ID is invalid'
        };
      default:
        return {
          type: 'DATABASE_ERROR',
          message: 'A database error occurred',
          code: error.code
        };
    }
  }

  // Generic database errors
  return {
    type: 'DATABASE_ERROR',
    message: 'An unexpected database error occurred'
  };
}

/**
 * Execute database operation with error handling
 * @param {Function} operation - Database operation function
 * @returns {Promise<any>} Operation result
 */
async function executeWithErrorHandling(operation) {
  try {
    return await operation();
  } catch (error) {
    const formattedError = handleDatabaseError(error);
    throw new Error(JSON.stringify(formattedError));
  }
}

/**
 * Execute database operation with retry logic
 * @param {Function} operation - Database operation function
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in ms
 * @returns {Promise<any>} Operation result
 */
async function executeWithRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.code === 'P2002' || error.code === 'P2025') {
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.warn(`🔄 Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

/**
 * Get database connection pool status
 * @returns {Promise<Object>} Pool status information
 */
async function getConnectionPoolStatus() {
  try {
    const client = getPrismaClient();
    
    // Get basic connection info
    const result = await client.$queryRaw`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    
    return {
      timestamp: new Date().toISOString(),
      connections: result[0] || { total_connections: 0, active_connections: 0, idle_connections: 0 },
      pool_config: {
        max_connections: parseInt(process.env.DATABASE_POOL_MAX) || 10,
        timeout: parseInt(process.env.DATABASE_TIMEOUT) || 30000
      }
    };
  } catch (error) {
    console.error('Failed to get connection pool status:', error);
    return {
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve connection pool status'
    };
  }
}

/**
 * Optimize database performance with prepared statements
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<any>} Query result
 */
async function executeOptimizedQuery(query, params = []) {
  const client = getPrismaClient();
  
  try {
    // Use prepared statements for better performance
    return await client.$queryRawUnsafe(query, ...params);
  } catch (error) {
    console.error('Optimized query failed:', error);
    throw handleDatabaseError(error);
  }
}

module.exports = {
  getPrismaClient,
  connectDatabase,
  disconnectDatabase,
  testDatabaseConnection,
  ensureConnection,
  handleDatabaseError,
  executeWithErrorHandling,
  executeWithRetry,
  getConnectionPoolStatus,
  executeOptimizedQuery
};