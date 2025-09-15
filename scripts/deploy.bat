@echo off
REM Real-Time Chat App Deployment Script for Windows
REM Usage: scripts\deploy.bat [environment]
REM Environments: development, staging, production, docker

setlocal enabledelayedexpansion

set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=development

set PROJECT_NAME=real-time-chat-app
set BACKUP_DIR=backups
set LOG_FILE=deploy.log

echo [%date% %time%] Starting deployment for environment: %ENVIRONMENT% >> %LOG_FILE%

REM Check prerequisites
echo Checking prerequisites...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed
    exit /b 1
)

if "%ENVIRONMENT%"=="production" (
    where pm2 >nul 2>nul
    if %errorlevel% neq 0 (
        echo ERROR: PM2 is not installed. Install with: npm install -g pm2
        exit /b 1
    )
)

echo Prerequisites check completed

REM Check environment files
if not "%ENVIRONMENT%"=="docker" (
    if not exist "backend\.env" (
        echo ERROR: Backend .env file not found. Copy from .env.example and configure.
        exit /b 1
    )
    if not exist "frontend\.env" (
        echo ERROR: Frontend .env file not found. Copy from .env.example and configure.
        exit /b 1
    )
)

REM Install dependencies
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 exit /b 1

cd backend
call npm install
if %errorlevel% neq 0 exit /b 1
cd ..

cd frontend
call npm install
if %errorlevel% neq 0 exit /b 1
cd ..

echo Dependencies installed

REM Build application
echo Building application...
cd frontend
call npm run build
if %errorlevel% neq 0 exit /b 1
cd ..

echo Application built

REM Setup database
echo Setting up database...
cd backend
call npx prisma generate
if %errorlevel% neq 0 exit /b 1

if "%ENVIRONMENT%"=="production" (
    call npx prisma migrate deploy
) else (
    call npx prisma migrate dev
)
if %errorlevel% neq 0 exit /b 1

if not "%ENVIRONMENT%"=="production" (
    call npm run db:seed
)

cd ..
echo Database setup completed

REM Deploy application
echo Deploying application for %ENVIRONMENT% environment...

if "%ENVIRONMENT%"=="development" (
    echo Starting development servers...
    start "Backend" cmd /k "cd backend && npm run dev"
    timeout /t 5 /nobreak >nul
    start "Frontend" cmd /k "cd frontend && npm run dev"
) else if "%ENVIRONMENT%"=="production" (
    echo Starting production servers with PM2...
    call pm2 start ecosystem.config.js --env production
    call pm2 save
) else if "%ENVIRONMENT%"=="docker" (
    echo Starting Docker containers...
    call docker-compose up -d
) else if "%ENVIRONMENT%"=="docker-dev" (
    echo Starting Docker development environment...
    call docker-compose -f docker-compose.dev.yml up -d
) else if "%ENVIRONMENT%"=="docker-prod" (
    echo Starting Docker production environment...
    call docker-compose -f docker-compose.prod.yml up -d
) else (
    echo ERROR: Unknown environment: %ENVIRONMENT%
    exit /b 1
)

echo Application deployed

REM Health check
echo Performing health check...
timeout /t 10 /nobreak >nul

curl -f http://localhost:5000/health >nul 2>nul
if %errorlevel% equ 0 (
    echo Backend health check passed
) else (
    echo WARNING: Backend health check failed
)

echo Deployment completed successfully!
echo Application is running on:
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo   Health:   http://localhost:5000/health

endlocal