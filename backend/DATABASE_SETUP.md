# Database Setup Guide

This guide will help you set up PostgreSQL for the real-time messaging application.

## Prerequisites

- PostgreSQL 12 or higher installed on your system
- Node.js and npm installed

## Installation

### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user

### macOS
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Database Setup

1. **Create the databases:**
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create main database
CREATE DATABASE messaging_app;

-- Create test database
CREATE DATABASE messaging_app_test;

-- Create a user for the application (optional but recommended)
CREATE USER messaging_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE messaging_app TO messaging_user;
GRANT ALL PRIVILEGES ON DATABASE messaging_app_test TO messaging_user;

-- Exit psql
\q
```

2. **Configure environment variables:**

Copy `.env.example` to `.env` and update the database configuration:
```bash
cp .env.example .env
```

Update the following variables in `.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=messaging_app
DB_USER=messaging_user  # or postgres
DB_PASSWORD=your_secure_password
DATABASE_URL=postgresql://messaging_user:your_secure_password@localhost:5432/messaging_app
```

3. **Run database migrations:**
```bash
npm run migrate
```

4. **Seed the database with sample data (optional):**
```bash
npm run seed
```

## Available Database Commands

- `npm run migrate` - Run all pending migrations
- `npm run migrate:rollback` - Rollback the last migration
- `npm run seed` - Seed the database with sample data
- `npm run db:setup` - Run migrations and seed data
- `npm test` - Run database tests (requires test database)

## Testing

The test suite requires a separate test database. Make sure to:

1. Create the test database as shown above
2. Copy `.env.test.example` to `.env.test` if needed
3. Update test database credentials in `.env.test`
4. Run tests with `npm test`

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running: `sudo systemctl status postgresql` (Linux) or check Services (Windows)
- Verify connection details in your `.env` file
- Check if the database exists: `psql -U postgres -l`

### Permission Issues
- Make sure your database user has the necessary permissions
- For development, you can use the `postgres` superuser

### Migration Issues
- Check that all migration files are present in `src/migrations/`
- Ensure migrations are run in the correct order (they're numbered)
- Check the `migrations` table to see which migrations have been executed

## Database Schema

The application uses three main tables:

1. **users** - Store user account information
2. **contacts** - Store user relationships/contacts
3. **messages** - Store chat messages between users

See the migration files in `src/migrations/` for detailed schema definitions.