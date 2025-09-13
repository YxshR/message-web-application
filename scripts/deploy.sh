#!/bin/bash

# Real-time Messaging App Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="realtime-messaging-app"
DEPLOY_ENV=${1:-production}
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p logs backups

log "Starting deployment for $APP_NAME in $DEPLOY_ENV environment"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL client is not installed"
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        log "Docker is available"
    else
        warning "Docker is not available - manual deployment will be used"
    fi
    
    success "Prerequisites check completed"
}

# Backup database
backup_database() {
    if [ "$DEPLOY_ENV" = "production" ]; then
        log "Creating database backup..."
        
        # Load environment variables
        if [ -f "backend/.env.production" ]; then
            source backend/.env.production
        else
            error "Production environment file not found"
        fi
        
        # Create backup
        BACKUP_FILE="$BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql"
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            success "Database backup created: $BACKUP_FILE"
        else
            error "Database backup failed"
        fi
    else
        log "Skipping database backup for $DEPLOY_ENV environment"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    cd backend
    npm install --production
    cd ..
    
    # Install frontend dependencies
    cd frontend
    npm install --production
    cd ..
    
    success "Dependencies installed successfully"
}

# Build applications
build_applications() {
    log "Building applications..."
    
    # Set environment
    export NODE_ENV=$DEPLOY_ENV
    
    # Build frontend
    log "Building frontend..."
    cd frontend
    npm run build
    cd ..
    
    # Backend doesn't need building (Node.js)
    log "Backend build completed (no compilation needed)"
    
    success "Applications built successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    cd backend
    npm run migrate
    
    if [ $? -eq 0 ]; then
        success "Database migrations completed"
    else
        error "Database migrations failed"
    fi
    
    cd ..
}

# Seed database (development only)
seed_database() {
    if [ "$DEPLOY_ENV" != "production" ]; then
        log "Seeding database with test data..."
        
        cd backend
        npm run seed
        
        if [ $? -eq 0 ]; then
            success "Database seeded successfully"
        else
            warning "Database seeding failed (this may be expected)"
        fi
        
        cd ..
    else
        log "Skipping database seeding for production environment"
    fi
}

# Run tests
run_tests() {
    if [ "$DEPLOY_ENV" != "production" ]; then
        log "Running test suite..."
        
        # Run backend tests
        cd backend
        npm test -- --passWithNoTests
        cd ..
        
        # Run frontend tests
        cd frontend
        npm test -- --watchAll=false --passWithNoTests
        cd ..
        
        success "All tests passed"
    else
        log "Skipping tests for production deployment"
    fi
}

# Deploy with Docker
deploy_docker() {
    log "Deploying with Docker..."
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down
    
    # Build and start containers
    docker-compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be ready
    log "Waiting for services to start..."
    sleep 30
    
    # Check if services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        success "Docker deployment completed successfully"
    else
        error "Docker deployment failed"
    fi
}

# Deploy manually
deploy_manual() {
    log "Deploying manually..."
    
    # Stop existing processes (if any)
    pkill -f "node.*server.js" || true
    pkill -f "serve.*frontend/build" || true
    
    # Start backend
    log "Starting backend server..."
    cd backend
    nohup npm run start:production > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../logs/backend.pid
    cd ..
    
    # Wait for backend to start
    sleep 10
    
    # Check if backend is running
    if kill -0 $BACKEND_PID 2>/dev/null; then
        success "Backend started successfully (PID: $BACKEND_PID)"
    else
        error "Backend failed to start"
    fi
    
    # Start frontend (using serve)
    log "Starting frontend server..."
    nohup npx serve -s frontend/build -l 3000 > logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > logs/frontend.pid
    
    # Wait for frontend to start
    sleep 5
    
    # Check if frontend is running
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        success "Frontend started successfully (PID: $FRONTEND_PID)"
    else
        error "Frontend failed to start"
    fi
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check backend health
    if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
        success "Backend health check passed"
    else
        error "Backend health check failed"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 > /dev/null 2>&1; then
        success "Frontend health check passed"
    else
        error "Frontend health check failed"
    fi
}

# Cleanup old deployments
cleanup() {
    log "Cleaning up old deployments..."
    
    # Remove old log files (keep last 10)
    find logs -name "deploy-*.log" -type f | sort -r | tail -n +11 | xargs rm -f
    
    # Remove old database backups (keep last 5)
    find backups -name "db-backup-*.sql" -type f | sort -r | tail -n +6 | xargs rm -f
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "=== Starting Deployment Process ==="
    
    check_prerequisites
    backup_database
    install_dependencies
    build_applications
    run_migrations
    seed_database
    run_tests
    
    # Choose deployment method
    if command -v docker &> /dev/null && [ -f "docker-compose.prod.yml" ]; then
        deploy_docker
    else
        deploy_manual
    fi
    
    health_check
    cleanup
    
    success "=== Deployment completed successfully ==="
    log "Application is now running:"
    log "  Frontend: http://localhost:3000"
    log "  Backend:  http://localhost:5000"
    log "  Logs:     tail -f logs/backend.log logs/frontend.log"
}

# Handle script arguments
case "$1" in
    "production"|"staging"|"development")
        main
        ;;
    "rollback")
        log "Rolling back deployment..."
        # Add rollback logic here
        ;;
    "status")
        log "Checking deployment status..."
        # Add status check logic here
        ;;
    *)
        echo "Usage: $0 {production|staging|development|rollback|status}"
        echo ""
        echo "Examples:"
        echo "  $0 production    # Deploy to production"
        echo "  $0 development   # Deploy to development"
        echo "  $0 rollback      # Rollback last deployment"
        echo "  $0 status        # Check deployment status"
        exit 1
        ;;
esac