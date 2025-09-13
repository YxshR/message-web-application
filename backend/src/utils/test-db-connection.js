#!/usr/bin/env node

const { testConnection, pool } = require('../config/database');

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  console.log('Database configuration:');
  console.log(`- Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`- Port: ${process.env.DB_PORT || '5432'}`);
  console.log(`- Database: ${process.env.DB_NAME || 'messaging_app'}`);
  console.log(`- User: ${process.env.DB_USER || 'not set'}`);
  console.log('');

  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      console.log('✅ Database connection successful!');
      
      // Test a simple query
      const { query } = require('../config/database');
      const result = await query('SELECT version() as version, NOW() as current_time');
      console.log('✅ Database query test successful!');
      console.log(`   PostgreSQL Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
      console.log(`   Current Time: ${result.rows[0].current_time}`);
      
    } else {
      console.log('❌ Database connection failed!');
      console.log('\nTroubleshooting steps:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. Check your .env file configuration');
      console.log('3. Verify the database exists');
      console.log('4. Check user permissions');
      console.log('\nSee DATABASE_SETUP.md for detailed setup instructions.');
    }
    
  } catch (error) {
    console.log('❌ Database connection error:', error.message);
    console.log('\nCommon issues:');
    console.log('- PostgreSQL service not running');
    console.log('- Incorrect database credentials');
    console.log('- Database does not exist');
    console.log('- Network connectivity issues');
    console.log('\nSee DATABASE_SETUP.md for setup instructions.');
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testDatabaseConnection()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testDatabaseConnection;