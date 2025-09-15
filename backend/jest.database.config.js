module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/database/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/database/setup.js'],
  testTimeout: 30000,
  maxWorkers: 1, // Run database tests sequentially
  forceExit: true,
  detectOpenHandles: true,
};