#!/bin/bash

# Real-Time Chat App Setup Script
# This script sets up the development environment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    log "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version 18 or higher is required. Current version: $(node --version)"
    fi
    
    success "Node.js $(node --version) is installed"
}

# Check if PostgreSQL is available
check_postgres() {
    log "Checking PostgreSQL availability..."
    if command -v psql &> /dev/null; then
        success "PostgreSQL client is available"
    else
        warning "PostgreSQL client not found. Make sure PostgreSQL is installed or use Docker"
    fi
}

# Setup environment files
setup_env_files() {
    log "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        log "Created backend/.env from example"
        warning "Please edit backend/.env with your configuration"
    else
        log "Backend .env already exists"
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        cp frontend/.env.example frontend/.env
        log "Created frontend/.env from example"
        warning "Please edit frontend/.env with your configuration"
    else
        log "Frontend .env already exists"
    fi
    
    success "Environment files setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Root dependencies
    npm install
    
    # Backend dependencies
    cd backend
    npm install
    cd ..
    
    # Frontend dependencies
    cd frontend
    npm install
    cd ..
    
    success "All dependencies installed"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    cd backend
    
    # Generate Prisma client
    npx prisma generate
    
    # Check if database is accessible
    if npx prisma db push --accept-data-loss 2>/dev/null; then
        success "Database schema updated"
        
        # Seed database
        if npm run db:seed; then
            success "Database seeded with initial data"
        else
            warning "Database seeding failed - you may need to seed manually"
        fi
    else
        warning "Could not connect to database. Please check your DATABASE_URL in backend/.env"
    fi
    
    cd ..
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p backend/logs
    mkdir -p backups
    mkdir -p scripts
    
    success "Directories created"
}

# Setup Git hooks (optional)
setup_git_hooks() {
    if [ -d ".git" ]; then
        log "Setting up Git hooks..."
        
        # Pre-commit hook for linting
        cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "Running pre-commit checks..."

# Run linting
npm run lint || exit 1

# Run tests
npm run test || exit 1

echo "Pre-commit checks passed!"
EOF
        
        chmod +x .git/hooks/pre-commit
        success "Git hooks setup completed"
    fi
}

# Main setup function
main() {
    log "Starting Real-Time Chat App setup..."
    
    check_node
    check_postgres
    create_directories
    setup_env_files
    install_dependencies
    setup_database
    setup_git_hooks
    
    success "Setup completed successfully!"
    echo
    log "Next steps:"
    echo "1. Edit backend/.env with your database configuration"
    echo "2. Edit frontend/.env with your API URLs"
    echo "3. Run 'npm run dev' to start development servers"
    echo "4. Visit http://localhost:3000 to see the application"
    echo
    log "Available commands:"
    echo "  npm run dev          - Start development servers"
    echo "  npm run build        - Build for production"
    echo "  npm test             - Run tests"
    echo "  npm run db:setup     - Setup database"
    echo "  npm run docker:dev   - Start with Docker"
    echo
    log "For deployment instructions, see DEPLOYMENT.md"
}

# Run main function
main