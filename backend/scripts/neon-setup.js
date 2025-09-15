#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Neon database configuration...\n');

const envPath = path.join(__dirname, '..', '.env');
const neonUrl = 'postgresql://neondb_owner:npg_Lk6haTP5eioI@ep-holy-grass-a1ijxxbz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

// Read current .env file
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Update or add DATABASE_URL
const lines = envContent.split('\n');
let found = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('DATABASE_URL=')) {
    lines[i] = `DATABASE_URL="${neonUrl}"`;
    found = true;
    break;
  }
}

if (!found) {
  lines.push(`DATABASE_URL="${neonUrl}"`);
}

// Write back to .env
fs.writeFileSync(envPath, lines.join('\n'));

console.log('✅ Updated .env file with Neon database URL');
console.log('🔗 Database URL configured for Neon PostgreSQL');
console.log('\nYou can now run:');
console.log('  npm run db:generate  # Generate Prisma client');
console.log('  npm run db:seed      # Seed database');
console.log('  npm run dev          # Start development server');
console.log('  npm run test:db      # Run database tests');