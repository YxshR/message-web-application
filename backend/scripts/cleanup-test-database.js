#!/usr/bin/env node

/**
 * Cleanup test database after running tests
 * Clears all test data and resets the database
 */

const { PrismaClient } = require('@prisma/client');
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

async function cleanupTestDatabase() {
  log(`${colors.bold}Cleaning up test database...${colors.reset}`);
  
  const prisma = new PrismaClient();
  
  try {
    // Clear all tables in correct order (respecting foreign key constraints)
    log(`${colors.blue}Clearing messages...${colors.reset}`);
    await prisma.message.deleteMany();
    
    log(`${colors.blue}Clearing conversation participants...${colors.reset}`);
    await prisma.conversationParticipant.deleteMany();
    
    log(`${colors.blue}Clearing conversations...${colors.reset}`);
    await prisma.conversation.deleteMany();
    
    log(`${colors.blue}Clearing contacts...${colors.reset}`);
    await prisma.contact.deleteMany();
    
    log(`${colors.blue}Clearing users...${colors.reset}`);
    await prisma.user.deleteMany();
    
    log(`${colors.green}✓ Test database cleaned successfully${colors.reset}`);
    
  } catch (error) {
    log(`${colors.red}✗ Test database cleanup failed: ${error.message}${colors.reset}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cleanupTestDatabase().catch((error) => {
    log(`${colors.red}Test database cleanup failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { cleanupTestDatabase };