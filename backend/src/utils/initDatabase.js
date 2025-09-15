const { connectDatabase, testDatabaseConnection } = require('./database');

/**
 * Initialize database connection and verify it's working
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  console.log('🔄 Initializing database connection...');
  
  try {
    // Connect to database
    await connectDatabase();
    
    // Test the connection
    const isConnected = await testDatabaseConnection();
    
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }
    
    console.log('✅ Database initialization completed successfully');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure PostgreSQL is running and accessible');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 Check your database credentials in the .env file');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('💡 Make sure the database exists or run migrations first');
    }
    
    throw error;
  }
}

/**
 * Graceful shutdown handler for database
 */
function setupDatabaseShutdown() {
  const { disconnectDatabase } = require('./database');
  
  const gracefulShutdown = async (signal) => {
    console.log(`\n🔄 Received ${signal}. Shutting down gracefully...`);
    
    try {
      await disconnectDatabase();
      console.log('✅ Database disconnected successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during database shutdown:', error);
      process.exit(1);
    }
  };
  
  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      console.error('❌ Error during emergency database shutdown:', disconnectError);
    }
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      console.error('❌ Error during emergency database shutdown:', disconnectError);
    }
    process.exit(1);
  });
}

module.exports = {
  initializeDatabase,
  setupDatabaseShutdown
};