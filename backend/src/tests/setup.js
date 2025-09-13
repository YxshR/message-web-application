// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'messaging_app_test';

// Increase timeout for database operations
jest.setTimeout(10000);