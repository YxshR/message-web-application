#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  WARNING: This will delete all data in your database!');

rl.question('Are you sure you want to reset the database? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    try {
      console.log('\n🔄 Resetting database...');
      
      execSync('npx prisma migrate reset --force', { 
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit' 
      });
      
      console.log('✅ Database reset completed');
      console.log('🌱 Database has been seeded with initial data');
      
    } catch (error) {
      console.error('\n❌ Database reset failed:', error.message);
      process.exit(1);
    }
  } else {
    console.log('Database reset cancelled.');
  }
  
  rl.close();
});