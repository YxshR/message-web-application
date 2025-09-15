#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up database for Real-time Chat App...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created');
  console.log('⚠️  Please update the DATABASE_URL in .env with your PostgreSQL credentials\n');
}

try {
  console.log('🔄 Generating Prisma client...');
  execSync('npx prisma generate', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' 
  });
  console.log('✅ Prisma client generated\n');

  console.log('🔄 Running database migrations...');
  execSync('npx prisma migrate dev --name init', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' 
  });
  console.log('✅ Database migrations completed\n');

  console.log('🌱 Seeding database with initial data...');
  execSync('npm run db:seed', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' 
  });
  console.log('✅ Database seeded successfully\n');

  console.log('🎉 Database setup completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Test the API endpoints');
  console.log('3. Check database health: GET /health/db');

} catch (error) {
  console.error('\n❌ Database setup failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('1. Make sure PostgreSQL is running');
  console.log('2. Check your DATABASE_URL in .env file');
  console.log('3. Ensure the database exists');
  console.log('4. Verify database credentials');
  process.exit(1);
}