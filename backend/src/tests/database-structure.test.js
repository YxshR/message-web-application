// Test database module structure without requiring actual database connection
const fs = require('fs');
const path = require('path');

describe('Database Module Structure', () => {
  test('database config module should export required functions', () => {
    const dbModule = require('../config/database');
    
    expect(dbModule).toHaveProperty('pool');
    expect(dbModule).toHaveProperty('query');
    expect(dbModule).toHaveProperty('transaction');
    expect(dbModule).toHaveProperty('testConnection');
    
    expect(typeof dbModule.query).toBe('function');
    expect(typeof dbModule.transaction).toBe('function');
    expect(typeof dbModule.testConnection).toBe('function');
  });

  test('migration files should exist', () => {
    const migrationsDir = path.join(__dirname, '../migrations');
    
    expect(fs.existsSync(migrationsDir)).toBe(true);
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    expect(migrationFiles).toContain('001_create_users_table.sql');
    expect(migrationFiles).toContain('002_create_contacts_table.sql');
    expect(migrationFiles).toContain('003_create_messages_table.sql');
  });

  test('migration runner should export required functions', () => {
    const migrateModule = require('../migrations/migrate');
    
    expect(migrateModule).toHaveProperty('runMigrations');
    expect(migrateModule).toHaveProperty('rollbackLastMigration');
    
    expect(typeof migrateModule.runMigrations).toBe('function');
    expect(typeof migrateModule.rollbackLastMigration).toBe('function');
  });

  test('seed module should export required functions', () => {
    const seedModule = require('../seeds/seed');
    
    expect(seedModule).toHaveProperty('seedDatabase');
    expect(seedModule).toHaveProperty('clearData');
    
    expect(typeof seedModule.seedDatabase).toBe('function');
    expect(typeof seedModule.clearData).toBe('function');
  });

  test('migration files should contain valid SQL', () => {
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'));
    
    migrationFiles.forEach(file => {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Basic SQL validation
      expect(content).toContain('CREATE TABLE');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  test('users migration should have proper structure', () => {
    const usersFile = path.join(__dirname, '../migrations/001_create_users_table.sql');
    const content = fs.readFileSync(usersFile, 'utf8');
    
    expect(content).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(content).toContain('id SERIAL PRIMARY KEY');
    expect(content).toContain('name VARCHAR(100) NOT NULL');
    expect(content).toContain('email VARCHAR(255) UNIQUE NOT NULL');
    expect(content).toContain('password_hash VARCHAR(255) NOT NULL');
    expect(content).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    expect(content).toContain('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    expect(content).toContain('last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  });

  test('contacts migration should have proper structure', () => {
    const contactsFile = path.join(__dirname, '../migrations/002_create_contacts_table.sql');
    const content = fs.readFileSync(contactsFile, 'utf8');
    
    expect(content).toContain('CREATE TABLE IF NOT EXISTS contacts');
    expect(content).toContain('id SERIAL PRIMARY KEY');
    expect(content).toContain('user_id INTEGER NOT NULL REFERENCES users(id)');
    expect(content).toContain('contact_user_id INTEGER NOT NULL REFERENCES users(id)');
    expect(content).toContain('ON DELETE CASCADE');
    expect(content).toContain('UNIQUE(user_id, contact_user_id)');
  });

  test('messages migration should have proper structure', () => {
    const messagesFile = path.join(__dirname, '../migrations/003_create_messages_table.sql');
    const content = fs.readFileSync(messagesFile, 'utf8');
    
    expect(content).toContain('CREATE TABLE IF NOT EXISTS messages');
    expect(content).toContain('id SERIAL PRIMARY KEY');
    expect(content).toContain('sender_id INTEGER NOT NULL REFERENCES users(id)');
    expect(content).toContain('recipient_id INTEGER NOT NULL REFERENCES users(id)');
    expect(content).toContain('content TEXT NOT NULL');
    expect(content).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    expect(content).toContain('read_at TIMESTAMP NULL');
    expect(content).toContain('message_type VARCHAR(20) DEFAULT \'text\'');
  });

  test('database indexes should be properly defined', () => {
    const messagesFile = path.join(__dirname, '../migrations/003_create_messages_table.sql');
    const content = fs.readFileSync(messagesFile, 'utf8');
    
    // Check for performance indexes
    expect(content).toContain('idx_messages_conversation');
    expect(content).toContain('idx_messages_recipient');
    expect(content).toContain('idx_messages_sender');
    expect(content).toContain('idx_messages_unread');
  });
});