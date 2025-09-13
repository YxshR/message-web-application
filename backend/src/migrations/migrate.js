const fs = require('fs').promises;
const path = require('path');
const { pool, query } = require('../config/database');

// Create migrations tracking table
const createMigrationsTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await query(createTableQuery);
};

// Get list of executed migrations
const getExecutedMigrations = async () => {
  try {
    const result = await query('SELECT filename FROM migrations ORDER BY executed_at');
    return result.rows.map(row => row.filename);
  } catch (err) {
    // If migrations table doesn't exist, return empty array
    return [];
  }
};

// Execute a single migration file
const executeMigration = async (filename, filePath) => {
  try {
    console.log(`Executing migration: ${filename}`);
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Execute the migration SQL
    await query(sql);
    
    // Record the migration as executed
    await query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    
    console.log(`✓ Migration ${filename} executed successfully`);
  } catch (err) {
    console.error(`✗ Migration ${filename} failed:`, err.message);
    throw err;
  }
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    console.log('Starting database migrations...');
    
    // Create migrations table if it doesn't exist
    await createMigrationsTable();
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations();
    
    // Get all migration files
    const migrationsDir = __dirname;
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensure migrations run in order
    
    // Execute pending migrations
    let executedCount = 0;
    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        const filePath = path.join(migrationsDir, file);
        await executeMigration(file, filePath);
        executedCount++;
      }
    }
    
    if (executedCount === 0) {
      console.log('No pending migrations to execute');
    } else {
      console.log(`✓ Executed ${executedCount} migration(s) successfully`);
    }
    
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  }
};

// Rollback last migration (for development)
const rollbackLastMigration = async () => {
  try {
    const result = await query(
      'SELECT filename FROM migrations ORDER BY executed_at DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.log('No migrations to rollback');
      return;
    }
    
    const lastMigration = result.rows[0].filename;
    console.log(`Rolling back migration: ${lastMigration}`);
    
    // Remove from migrations table
    await query('DELETE FROM migrations WHERE filename = $1', [lastMigration]);
    
    console.log(`✓ Rolled back migration: ${lastMigration}`);
    console.log('Note: You may need to manually drop tables/columns created by this migration');
    
  } catch (err) {
    console.error('Rollback failed:', err.message);
    throw err;
  }
};

module.exports = {
  runMigrations,
  rollbackLastMigration
};

// Allow running migrations directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackLastMigration()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    runMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}