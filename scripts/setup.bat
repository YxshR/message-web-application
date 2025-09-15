@echo off
REM Real-Time Chat App Setup Script for Windows

setlocal enabledelayedexpansion

echo Starting Real-Time Chat App setup...

REM Check Node.js
echo Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)

for /f "tokens=1 delims=v" %%i in ('node --version') do set NODE_VERSION=%%i
echo SUCCESS: Node.js %NODE_VERSION% is installed

REM Create directories
echo Creating necessary directories...
if not exist "backend\logs" mkdir backend\logs
if not exist "backups" mkdir backups
if not exist "scripts" mkdir scripts
echo SUCCESS: Directories created

REM Setup environment files
echo Setting up environment files...

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo Created backend\.env from example
    echo WARNING: Please edit backend\.env with your configuration
) else (
    echo Backend .env already exists
)

if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
    echo Created frontend\.env from example
    echo WARNING: Please edit frontend\.env with your configuration
) else (
    echo Frontend .env already exists
)

echo SUCCESS: Environment files setup completed

REM Install dependencies
echo Installing dependencies...

call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install root dependencies
    exit /b 1
)

cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    exit /b 1
)
cd ..

cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    exit /b 1
)
cd ..

echo SUCCESS: All dependencies installed

REM Setup database
echo Setting up database...
cd backend

call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    exit /b 1
)

call npx prisma db push --accept-data-loss >nul 2>nul
if %errorlevel% equ 0 (
    echo SUCCESS: Database schema updated
    
    call npm run db:seed >nul 2>nul
    if %errorlevel% equ 0 (
        echo SUCCESS: Database seeded with initial data
    ) else (
        echo WARNING: Database seeding failed - you may need to seed manually
    )
) else (
    echo WARNING: Could not connect to database. Please check your DATABASE_URL in backend\.env
)

cd ..

echo.
echo SUCCESS: Setup completed successfully!
echo.
echo Next steps:
echo 1. Edit backend\.env with your database configuration
echo 2. Edit frontend\.env with your API URLs
echo 3. Run 'npm run dev' to start development servers
echo 4. Visit http://localhost:3000 to see the application
echo.
echo Available commands:
echo   npm run dev          - Start development servers
echo   npm run build        - Build for production
echo   npm test             - Run tests
echo   npm run db:setup     - Setup database
echo   npm run docker:dev   - Start with Docker
echo.
echo For deployment instructions, see DEPLOYMENT.md

endlocal