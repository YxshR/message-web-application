#!/bin/bash

# Real-Time Chat App Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environments: development, staging, production

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-development}
PROJECT_NAME="real-time-chat-app"
BACKUP_DIR="backups"
LOG_FILE="deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a $LOG_FILE
}

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
    
    # Check PostgreSQL (for local deployment)
    if [ "$ENVIRONMENT" != "docker" ] && ! command -v psql &> /dev/null; then
        warning "PostgreSQL client not found - make sure database is accessible"
    fi
    
    # Check PM2 (for production)
    if [ "$ENVIRONMENT" = "production" ] && ! command -v pm2 &> /dev/null; then
        error "PM2 is not installed. Install with: npm install -g pm2"
    fi
    
    success "Prerequisites check completed"
}

# Create backup
create_backup() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log "Creating backup..."
        
        # Create backup directory
        mkdir -p $BACKUP_DIR
        
        # Backup database (if local)
        if [ -n "$DATABASE_URL" ]; then
            BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
            log "Backing up database to $BACKUP_FILE"
            # Add your database backup command here
            # pg_dump $DATABASE_URL > $BACKUP_FILE
        fi
        
        # Backup current application (if exists)
        if [ -d "backend" ]; then
            BACKUP_APP="$BACKUP_DIR/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
            log "Backing up application to $BACKUP_APP"
            tar -czf $BACKUP_APP backend frontend package.json
        fi
        
        success "Backup completed"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install backend dependencies
    cd backend
    npm install
    cd ..
    
    # Install frontend dependencies
    cd frontend
    npm install
    cd ..
    
    success "Dependencies installed"
}

# Build application
build_application() {
    log "Building application..."
    
    # Build frontend
    cd frontend
    npm run build
    cd ..
    
    # Backend doesn't need building (Node.js)
    log "Backend build: No transpilation needed"
    
    success "Application built"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    cd backend
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    if [ "$ENVIRONMENT" = "production" ]; then
        npx prisma migrate deploy
    else
        npx prisma migrate dev
    fi
    
    # Seed database (optional)
    if [ "$ENVIRONMENT" != "production" ]; then
        npm run db:seed || warning "Database seeding failed or skipped"
    fi
    
    cd ..
    
    success "Database setup completed"
}

# Deploy application
deploy_application() {
    log "Deploying application for $ENVIRONMENT environment..."
    
    case $ENVIRONMENT in
        "development")
            log "Starting development servers..."
            npm run dev
            ;;
        "production")
            log "Starting production servers with PM2..."
            pm2 start ecosystem.config.js --env production
            pm2 save
            ;;
        "docker")
            log "Starting Docker containers..."
            docker-compose up -d
            ;;
        "docker-dev")
            log "Starting Docker development environment..."
            docker-compose -f docker-compose.dev.yml up -d
            ;;
        "docker-prod")
            log "Starting Docker production environment..."
            docker-compose -f docker-compose.prod.yml up -d
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            ;;
    esac
    
    success "Application deployed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for services to start
    sleep 10
    
    # Check backend health
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        success "Backend health check passed"
    else
        error "Backend health check failed"
    fi
    
    # Check database health
    if curl -f http://localhost:5000/health/db > /dev/null 2>&1; then
        success "Database health check passed"
    else
        warning "Database health check failed"
    fi
}

# Cleanup old deployments
cleanup() {
    log "Cleaning up..."
    
    # Remove old backups (keep last 5)
    if [ -d "$BACKUP_DIR" ]; then
        find $BACKUP_DIR -name "*.tar.gz" -type f -mtime +7 -delete
        find $BACKUP_DIR -name "*.sql" -type f -mtime +7 -delete
    fi
    
    # Clean npm cache
    npm cache clean --force
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    log "Starting deployment for environment: $ENVIRONMENT"
    
    # Check if environment file exists
    if [ "$ENVIRONMENT" != "docker" ] && [ "$ENVIRONMENT" != "docker-dev" ] && [ "$ENVIRONMENT" != "docker-prod" ]; then
        if [ ! -f "backend/.env" ]; then
            error "Backend .env file not found. Copy from .env.example and configure."
        fi
        if [ ! -f "frontend/.env" ]; then
            error "Frontend .env file not found. Copy from .env.example and configure."
        fi
    fi
    
    check_prerequisites
    create_backup
    install_dependencies
    build_application
    setup_database
    deploy_application
    health_check
    cleanup
    
    success "Deployment completed successfully!"
    log "Application is running on:"
    log "  Backend:  http://localhost:5000"
    log "  Frontend: http://localhost:3000"
    log "  Health:   http://localhost:5000/health"
}

# Handle script interruption
trap 'error "Deployment interrupted"' INT TERM

# Run main function
main