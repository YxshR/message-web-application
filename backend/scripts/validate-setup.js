#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating database setup...\n');

const checks = [
  {
    name: 'Prisma schema exists',
    check: () => fs.existsSync(path.join(__dirname, '..', 'prisma', 'schema.prisma')),
    fix: 'Prisma schema file is missing'
  },
  {
    name: 'Database utilities exist',
    check: () => fs.existsSync(path.join(__dirname, '..', 'src', 'utils', 'database.js')),
    fix: 'Database utilities file is missing'
  },
  {
    name: 'Database service exists',
    check: () => fs.existsSync(path.join(__dirname, '..', 'src', 'services', 'databaseService.js')),
    fix: 'Database service file is missing'
  },
  {
    name: 'Seed file exists',
    check: () => fs.existsSync(path.join(__dirname, '..', 'prisma', 'seed.js')),
    fix: 'Database seed file is missing'
  },
  {
    name: 'Environment template exists',
    check: () => fs.existsSync(path.join(__dirname, '..', '.env.example')),
    fix: 'Environment template file is missing'
  },
  {
    name: 'Database tests exist',
    check: () => fs.existsSync(path.join(__dirname, '..', 'tests', 'database')),
    fix: 'Database tests directory is missing'
  },
  {
    name: 'Setup scripts exist',
    check: () => fs.existsSync(path.join(__dirname, '..', 'scripts', 'setup-database.js')),
    fix: 'Database setup script is missing'
  }
];

let allPassed = true;

checks.forEach(({ name, check, fix }) => {
  const passed = check();
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}`);
  
  if (!passed) {
    console.log(`   ${fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All database infrastructure is properly set up!');
  console.log('\nNext steps:');
  console.log('1. Ensure PostgreSQL is running');
  console.log('2. Update .env with your database credentials');
  console.log('3. Run: npm run db:setup');
  console.log('4. Start the server: npm run dev');
} else {
  console.log('❌ Some database infrastructure is missing');
  console.log('Please check the issues above and fix them');
  process.exit(1);
}

// Test that we can import the modules
try {
  console.log('\n🔍 Testing module imports...');
  
  require('../src/utils/database');
  console.log('✅ Database utilities import successfully');
  
  require('../src/services/databaseService');
  console.log('✅ Database service imports successfully');
  
  require('../src/utils/initDatabase');
  console.log('✅ Database initialization imports successfully');
  
  console.log('\n🎉 All modules import without errors!');
  
} catch (error) {
  console.log('\n❌ Module import error:', error.message);
  process.exit(1);
}