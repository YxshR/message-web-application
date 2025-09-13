# Real-time Messaging App Deployment Script (PowerShell)
# This script handles the complete deployment process for Windows

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "staging", "development", "rollback", "status")]
    [string]$Environment = "production"
)

# Configuration
$AppName = "realtime-messaging-app"
$BackupDir = "./backups"
$LogFile = "./logs/deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Create necessary directories
New-Item -ItemType Directory -Force -Path "logs", "backups" | Out-Null

# Functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $logMessage -ForegroundColor Red }
        "SUCCESS" { Write-Host $logMessage -ForegroundColor Green }
        "WARNING" { Write-Host $logMessage -ForegroundColor Yellow }
        default { Write-Host $logMessage -ForegroundColor Blue }
    }
    
    Add-Content -Path $LogFile -Value $logMessage
}

function Test-Prerequisites {
    Write-Log "Checking prerequisites..."
    
    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Log "Node.js is not installed" "ERROR"
        exit 1
    }
    
    # Check npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Log "npm is not installed" "ERROR"
        exit 1
    }
    
    # Check PostgreSQL
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Write-Log "PostgreSQL client is not installed" "ERROR"
        exit 1
    }
    
    # Check Docker (optional)
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Log "Docker is available"
    } else {
        Write-Log "Docker is not available - manual deployment will be used" "WARNING"
    }
    
    Write-Log "Prerequisites check completed" "SUCCESS"
}

function Backup-Database {
    if ($Environment -eq "production") {
        Write-Log "Creating database backup..."
        
        # Load environment variables
        $envFile = "backend/.env.production"
        if (Test-Path $envFile) {
            Get-Content $envFile | ForEach-Object {
                if ($_ -match "^([^=]+)=(.*)$") {
                    [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
                }
            }
        } else {
            Write-Log "Production environment file not found" "ERROR"
            exit 1
        }
        
        # Create backup
        $backupFile = "$BackupDir/db-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
        $dbHost = $env:DB_HOST
        $dbPort = $env:DB_PORT
        $dbUser = $env:DB_USER
        $dbName = $env:DB_NAME
        
        & pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName > $backupFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Database backup created: $backupFile" "SUCCESS"
        } else {
            Write-Log "Database backup failed" "ERROR"
            exit 1
        }
    } else {
        Write-Log "Skipping database backup for $Environment environment"
    }
}

function Install-Dependencies {
    Write-Log "Installing dependencies..."
    
    # Install root dependencies
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Failed to install root dependencies" "ERROR"
        exit 1
    }
    
    # Install backend dependencies
    Set-Location backend
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Failed to install backend dependencies" "ERROR"
        exit 1
    }
    Set-Location ..
    
    # Install frontend dependencies
    Set-Location frontend
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Failed to install frontend dependencies" "ERROR"
        exit 1
    }
    Set-Location ..
    
    Write-Log "Dependencies installed successfully" "SUCCESS"
}

function Build-Applications {
    Write-Log "Building applications..."
    
    # Set environment
    $env:NODE_ENV = $Environment
    
    # Build frontend
    Write-Log "Building frontend..."
    Set-Location frontend
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Frontend build failed" "ERROR"
        exit 1
    }
    Set-Location ..
    
    # Backend doesn't need building (Node.js)
    Write-Log "Backend build completed (no compilation needed)"
    
    Write-Log "Applications built successfully" "SUCCESS"
}

function Invoke-Migrations {
    Write-Log "Running database migrations..."
    
    Set-Location backend
    npm run migrate
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Database migrations completed" "SUCCESS"
    } else {
        Write-Log "Database migrations failed" "ERROR"
        exit 1
    }
    
    Set-Location ..
}

function Invoke-DatabaseSeed {
    if ($Environment -ne "production") {
        Write-Log "Seeding database with test data..."
        
        Set-Location backend
        npm run seed
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Database seeded successfully" "SUCCESS"
        } else {
            Write-Log "Database seeding failed (this may be expected)" "WARNING"
        }
        
        Set-Location ..
    } else {
        Write-Log "Skipping database seeding for production environment"
    }
}

function Invoke-Tests {
    if ($Environment -ne "production") {
        Write-Log "Running test suite..."
        
        # Run backend tests
        Set-Location backend
        npm test -- --passWithNoTests
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Backend tests failed" "ERROR"
            exit 1
        }
        Set-Location ..
        
        # Run frontend tests
        Set-Location frontend
        npm test -- --watchAll=false --passWithNoTests
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Frontend tests failed" "ERROR"
            exit 1
        }
        Set-Location ..
        
        Write-Log "All tests passed" "SUCCESS"
    } else {
        Write-Log "Skipping tests for production deployment"
    }
}

function Deploy-WithDocker {
    Write-Log "Deploying with Docker..."
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down
    
    # Build and start containers
    docker-compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be ready
    Write-Log "Waiting for services to start..."
    Start-Sleep -Seconds 30
    
    # Check if services are running
    $runningServices = docker-compose -f docker-compose.prod.yml ps | Select-String "Up"
    if ($runningServices) {
        Write-Log "Docker deployment completed successfully" "SUCCESS"
    } else {
        Write-Log "Docker deployment failed" "ERROR"
        exit 1
    }
}

function Deploy-Manual {
    Write-Log "Deploying manually..."
    
    # Stop existing processes (if any)
    Get-Process | Where-Object { $_.ProcessName -like "*node*" -and $_.CommandLine -like "*server.js*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process | Where-Object { $_.ProcessName -like "*serve*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Start backend
    Write-Log "Starting backend server..."
    Set-Location backend
    $backendProcess = Start-Process -FilePath "npm" -ArgumentList "run", "start:production" -RedirectStandardOutput "../logs/backend.log" -RedirectStandardError "../logs/backend-error.log" -PassThru
    $backendProcess.Id | Out-File -FilePath "../logs/backend.pid"
    Set-Location ..
    
    # Wait for backend to start
    Start-Sleep -Seconds 10
    
    # Check if backend is running
    if (Get-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue) {
        Write-Log "Backend started successfully (PID: $($backendProcess.Id))" "SUCCESS"
    } else {
        Write-Log "Backend failed to start" "ERROR"
        exit 1
    }
    
    # Start frontend (using serve)
    Write-Log "Starting frontend server..."
    $frontendProcess = Start-Process -FilePath "npx" -ArgumentList "serve", "-s", "frontend/build", "-l", "3000" -RedirectStandardOutput "logs/frontend.log" -RedirectStandardError "logs/frontend-error.log" -PassThru
    $frontendProcess.Id | Out-File -FilePath "logs/frontend.pid"
    
    # Wait for frontend to start
    Start-Sleep -Seconds 5
    
    # Check if frontend is running
    if (Get-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue) {
        Write-Log "Frontend started successfully (PID: $($frontendProcess.Id))" "SUCCESS"
    } else {
        Write-Log "Frontend failed to start" "ERROR"
        exit 1
    }
}

function Test-Health {
    Write-Log "Performing health check..."
    
    # Check backend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Log "Backend health check passed" "SUCCESS"
        } else {
            Write-Log "Backend health check failed" "ERROR"
            exit 1
        }
    } catch {
        Write-Log "Backend health check failed: $($_.Exception.Message)" "ERROR"
        exit 1
    }
    
    # Check frontend
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Log "Frontend health check passed" "SUCCESS"
        } else {
            Write-Log "Frontend health check failed" "ERROR"
            exit 1
        }
    } catch {
        Write-Log "Frontend health check failed: $($_.Exception.Message)" "ERROR"
        exit 1
    }
}

function Invoke-Cleanup {
    Write-Log "Cleaning up old deployments..."
    
    # Remove old log files (keep last 10)
    Get-ChildItem -Path "logs" -Filter "deploy-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 10 | Remove-Item -Force
    
    # Remove old database backups (keep last 5)
    Get-ChildItem -Path "backups" -Filter "db-backup-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 | Remove-Item -Force
    
    Write-Log "Cleanup completed" "SUCCESS"
}

# Main deployment process
function Start-Deployment {
    Write-Log "=== Starting Deployment Process ===" "INFO"
    
    Test-Prerequisites
    Backup-Database
    Install-Dependencies
    Build-Applications
    Invoke-Migrations
    Invoke-DatabaseSeed
    Invoke-Tests
    
    # Choose deployment method
    if ((Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path "docker-compose.prod.yml")) {
        Deploy-WithDocker
    } else {
        Deploy-Manual
    }
    
    Test-Health
    Invoke-Cleanup
    
    Write-Log "=== Deployment completed successfully ===" "SUCCESS"
    Write-Log "Application is now running:"
    Write-Log "  Frontend: http://localhost:3000"
    Write-Log "  Backend:  http://localhost:5000"
    Write-Log "  Logs:     Get-Content logs/backend.log -Wait"
}

# Handle script arguments
switch ($Environment) {
    { $_ -in @("production", "staging", "development") } {
        Start-Deployment
    }
    "rollback" {
        Write-Log "Rolling back deployment..." "INFO"
        # Add rollback logic here
    }
    "status" {
        Write-Log "Checking deployment status..." "INFO"
        # Add status check logic here
    }
    default {
        Write-Host "Usage: .\deploy.ps1 [-Environment {production|staging|development|rollback|status}]"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\deploy.ps1 -Environment production    # Deploy to production"
        Write-Host "  .\deploy.ps1 -Environment development   # Deploy to development"
        Write-Host "  .\deploy.ps1 -Environment rollback      # Rollback last deployment"
        Write-Host "  .\deploy.ps1 -Environment status        # Check deployment status"
        exit 1
    }
}