#!/usr/bin/env node

/**
 * Setup test database for running tests
 * Creates a separate test database and runs migrations
 */

const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.test') });

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`${colors.blue}${description}...${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    log(`${colors.green}✓ ${description} completed${colors.reset}`);
    return true;
  } catch (error) {
    log(`${colors.red}✗ ${description} failed${colors.reset}`);
    return false;
  }
}

async function setupTestDatabase() {
  log(`${colors.bold}Setting up test database...${colors.reset}`);
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Generate Prisma client
  if (!runCommand('npx prisma generate', 'Generating Prisma client')) {
    process.exit(1);
  }
  
  // Push database schema (for test database)
  if (!runCommand('npx prisma db push --force-reset', 'Setting up test database schema')) {
    process.exit(1);
  }
  
  // Seed test data
  if (!runCommand('node prisma/seed.js', 'Seeding test database')) {
    log(`${colors.yellow}⚠ Test database seeding failed, continuing...${colors.reset}`);
  }
  
  log(`${colors.green}${colors.bold}Test database setup completed successfully!${colors.reset}`);
}

if (require.main === module) {
  setupTestDatabase().catch((error) => {
    log(`${colors.red}Test database setup failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { setupTestDatabase };