const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Production-safe migration runner
class ProductionMigrator {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            max: 5, // Limit connections during migration
        });
        
        this.migrationsDir = path.join(__dirname, '../migrations');
        this.backupDir = path.join(__dirname, '../../../backups');
    }

    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                checksum VARCHAR(64) NOT NULL
            );
        `;
        
        await this.pool.query(query);
        console.log('✓ Migrations table ready');
    }

    async getExecutedMigrations() {
        const result = await this.pool.query(
            'SELECT filename, checksum FROM migrations ORDER BY executed_at'
        );
        return result.rows;
    }

    async getMigrationFiles() {
        const files = fs.readdirSync(this.migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        
        return files.map(filename => {
            const filepath = path.join(this.migrationsDir, filename);
            const content = fs.readFileSync(filepath, 'utf8');
            const checksum = require('crypto')
                .createHash('sha256')
                .update(content)
                .digest('hex');
            
            return { filename, filepath, content, checksum };
        });
    }

    async createBackup() {
        if (process.env.NODE_ENV === 'production') {
            console.log('Creating database backup before migration...');
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `pre-migration-${timestamp}.sql`);
            
            // Ensure backup directory exists
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            
            // Create backup using pg_dump
            const { spawn } = require('child_process');
            
            return new Promise((resolve, reject) => {
                const pgDump = spawn('pg_dump', [
                    '-h', process.env.DB_HOST,
                    '-p', process.env.DB_PORT,
                    '-U', process.env.DB_USER,
                    '-d', process.env.DB_NAME,
                    '--no-password',
                    '--verbose'
                ], {
                    stdio: ['ignore', fs.openSync(backupFile, 'w'), 'pipe'],
                    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD }
                });
                
                pgDump.on('close', (code) => {
                    if (code === 0) {
                        console.log(`✓ Backup created: ${backupFile}`);
                        resolve(backupFile);
                    } else {
                        reject(new Error(`pg_dump failed with code ${code}`));
                    }
                });
                
                pgDump.stderr.on('data', (data) => {
                    console.log(`pg_dump: ${data}`);
                });
            });
        }
    }

    async executeMigration(migration) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            console.log(`Executing migration: ${migration.filename}`);
            
            // Execute the migration
            await client.query(migration.content);
            
            // Record the migration
            await client.query(
                'INSERT INTO migrations (filename, checksum) VALUES ($1, $2)',
                [migration.filename, migration.checksum]
            );
            
            await client.query('COMMIT');
            console.log(`✓ Migration completed: ${migration.filename}`);
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Migration failed: ${migration.filename} - ${error.message}`);
        } finally {
            client.release();
        }
    }

    async validateMigrations() {
        console.log('Validating existing migrations...');
        
        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();
        
        // Check for checksum mismatches
        for (const executed of executedMigrations) {
            const file = migrationFiles.find(f => f.filename === executed.filename);
            
            if (!file) {
                throw new Error(`Migration file not found: ${executed.filename}`);
            }
            
            if (file.checksum !== executed.checksum) {
                throw new Error(`Migration checksum mismatch: ${executed.filename}`);
            }
        }
        
        console.log('✓ Migration validation passed');
    }

    async run() {
        try {
            console.log('Starting production migration...');
            
            // Create migrations table
            await this.createMigrationsTable();
            
            // Validate existing migrations
            await this.validateMigrations();
            
            // Get pending migrations
            const executedMigrations = await this.getExecutedMigrations();
            const migrationFiles = await this.getMigrationFiles();
            
            const pendingMigrations = migrationFiles.filter(
                file => !executedMigrations.some(exec => exec.filename === file.filename)
            );
            
            if (pendingMigrations.length === 0) {
                console.log('✓ No pending migrations');
                return;
            }
            
            console.log(`Found ${pendingMigrations.length} pending migrations`);
            
            // Create backup before running migrations
            await this.createBackup();
            
            // Execute pending migrations
            for (const migration of pendingMigrations) {
                await this.executeMigration(migration);
            }
            
            console.log('✓ All migrations completed successfully');
            
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            
            if (process.env.NODE_ENV === 'production') {
                console.log('Please restore from backup if necessary');
            }
            
            process.exit(1);
        } finally {
            await this.pool.end();
        }
    }

    async rollback(steps = 1) {
        try {
            console.log(`Rolling back ${steps} migration(s)...`);
            
            // Create backup before rollback
            await this.createBackup();
            
            const executedMigrations = await this.getExecutedMigrations();
            const migrationsToRollback = executedMigrations
                .slice(-steps)
                .reverse();
            
            for (const migration of migrationsToRollback) {
                // Look for rollback file
                const rollbackFile = path.join(
                    this.migrationsDir,
                    'rollbacks',
                    migration.filename.replace('.sql', '.rollback.sql')
                );
                
                if (fs.existsSync(rollbackFile)) {
                    const rollbackContent = fs.readFileSync(rollbackFile, 'utf8');
                    
                    const client = await this.pool.connect();
                    try {
                        await client.query('BEGIN');
                        await client.query(rollbackContent);
                        await client.query(
                            'DELETE FROM migrations WHERE filename = $1',
                            [migration.filename]
                        );
                        await client.query('COMMIT');
                        
                        console.log(`✓ Rolled back: ${migration.filename}`);
                    } catch (error) {
                        await client.query('ROLLBACK');
                        throw error;
                    } finally {
                        client.release();
                    }
                } else {
                    console.warn(`⚠ No rollback file found for: ${migration.filename}`);
                }
            }
            
            console.log('✓ Rollback completed');
            
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
            process.exit(1);
        } finally {
            await this.pool.end();
        }
    }
}

// CLI interface
if (require.main === module) {
    require('dotenv').config();
    
    const migrator = new ProductionMigrator();
    const command = process.argv[2];
    
    switch (command) {
        case 'rollback':
            const steps = parseInt(process.argv[3]) || 1;
            migrator.rollback(steps);
            break;
        default:
            migrator.run();
    }
}

module.exports = ProductionMigrator;