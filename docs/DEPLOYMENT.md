# Deployment Guide

## Overview

This guide covers all deployment scenarios for the Real-time Messaging App, from local development to production environments. The application supports multiple deployment strategies including Docker containers, cloud platforms, and traditional server deployments.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB available space
- **Network**: Stable internet connection

**Recommended Requirements:**
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: High-speed internet with low latency

### Software Dependencies

**Required:**
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **PostgreSQL**: v12.0 or higher

**Optional:**
- **Docker**: v20.0.0 or higher
- **Docker Compose**: v2.0.0 or higher
- **Git**: v2.30.0 or higher

## Environment Setup

### 1. Development Environment

#### Quick Setup
```bash
# Clone the repository
git clone <repository-url>
cd realtime-messaging-app

# Install all dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Configure database connection in backend/.env
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=messaging_app_dev
# DB_USER=your_username
# DB_PASSWORD=your_password

# Set up database
createdb messaging_app_dev
cd backend && npm run db:setup

# Start development servers
npm run dev
```

#### Manual Setup
```bash
# 1. Install backend dependencies
cd backend
npm install
cd ..

# 2. Install frontend dependencies
cd frontend
npm install
cd ..

# 3. Set up PostgreSQL database
createdb messaging_app_dev
createuser messaging_user
psql -d messaging_app_dev -c "GRANT ALL PRIVILEGES ON DATABASE messaging_app_dev TO messaging_user;"

# 4. Run migrations and seed data
cd backend
npm run migrate
npm run seed
cd ..

# 5. Start services separately
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm start
```

### 2. Staging Environment

#### Environment Configuration
```bash
# Copy staging environment templates
cp backend/.env.staging.example backend/.env.staging
cp frontend/.env.staging.example frontend/.env.staging

# Edit configuration files with staging values
# backend/.env.staging:
NODE_ENV=staging
DB_HOST=staging-db.example.com
DB_NAME=messaging_app_staging
# ... other staging-specific values

# frontend/.env.staging:
REACT_APP_API_BASE_URL=https://staging-api.yourdomain.com
REACT_APP_ENVIRONMENT=staging
```

#### Deployment
```bash
# Deploy to staging
./scripts/deploy.sh staging

# Or using PowerShell on Windows
.\scripts\deploy.ps1 -Environment staging
```

### 3. Production Environment

#### Environment Configuration
```bash
# Copy production environment templates
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production

# Edit configuration files with production values
# backend/.env.production:
NODE_ENV=production
DB_HOST=prod-db.example.com
DB_NAME=messaging_app_prod
JWT_SECRET=your_super_secure_jwt_secret_here
# ... other production-specific values

# frontend/.env.production:
REACT_APP_API_BASE_URL=https://api.yourdomain.com
REACT_APP_ENVIRONMENT=production
GENERATE_SOURCEMAP=false
```

#### Deployment
```bash
# Deploy to production
./scripts/deploy.sh production

# Or using PowerShell on Windows
.\scripts\deploy.ps1 -Environment production
```

## Docker Deployment

### Development with Docker

#### Docker Compose Setup
```bash
# Create development docker-compose file
cat > docker-compose.dev.yml << EOF
version: '3.8'
services:
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: messaging_app_dev
      POSTGRES_USER: messaging_user
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
      target: development
    environment:
      NODE_ENV: development
      DB_HOST: database
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/usr/src/app
      - /usr/src/app/node_modules
    depends_on:
      - database

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  postgres_dev_data:
EOF

# Start development environment
docker-compose -f docker-compose.dev.yml up -d
```

### Production with Docker

#### Single Server Deployment
```bash
# 1. Set up environment variables
echo "DB_PASSWORD=your_secure_password" > .env
echo "JWT_SECRET=your_jwt_secret" >> .env

# 2. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 3. Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# 4. Check deployment status
docker-compose -f docker-compose.prod.yml ps
```

#### Multi-Server Deployment
```bash
# 1. Set up Docker Swarm (on manager node)
docker swarm init

# 2. Join worker nodes
# Run on worker nodes: docker swarm join --token <token> <manager-ip>:2377

# 3. Deploy stack
docker stack deploy -c docker-compose.prod.yml messaging-app

# 4. Scale services
docker service scale messaging-app_backend=3
docker service scale messaging-app_frontend=2
```

## Cloud Platform Deployment

### AWS Deployment

#### Using AWS ECS (Elastic Container Service)

**1. Prepare Infrastructure:**
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name messaging-app-cluster

# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier messaging-app-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username messaging_user \
  --master-user-password your_secure_password \
  --allocated-storage 20
```

**2. Build and Push Images:**
```bash
# Build images
docker build -f Dockerfile.backend -t messaging-app-backend .
docker build -f Dockerfile.frontend -t messaging-app-frontend .

# Tag for ECR
docker tag messaging-app-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/messaging-app-backend:latest
docker tag messaging-app-frontend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/messaging-app-frontend:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/messaging-app-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/messaging-app-frontend:latest
```

**3. Create ECS Task Definitions:**
```json
{
  "family": "messaging-app-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/messaging-app-backend:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DB_HOST",
          "value": "messaging-app-db.cluster-xyz.us-east-1.rds.amazonaws.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/messaging-app-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Using AWS Elastic Beanstalk

**1. Prepare Application:**
```bash
# Install EB CLI
pip install awsebcli

# Initialize Elastic Beanstalk
eb init messaging-app --region us-east-1 --platform "Node.js 18"

# Create environment
eb create production --database.engine postgres
```

**2. Deploy Application:**
```bash
# Create .ebextensions/01_nginx.config for frontend routing
mkdir .ebextensions
cat > .ebextensions/01_nginx.config << EOF
files:
  "/etc/nginx/conf.d/01_websockets.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      upstream nodejs {
        server 127.0.0.1:8081;
        keepalive 256;
      }
      
      server {
        listen 8080;
        
        location /socket.io/ {
          proxy_pass http://nodejs;
          proxy_http_version 1.1;
          proxy_set_header Upgrade \$http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host \$host;
          proxy_set_header X-Real-IP \$remote_addr;
          proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location / {
          proxy_pass http://nodejs;
          proxy_set_header Connection "";
          proxy_http_version 1.1;
          proxy_set_header Host \$host;
          proxy_set_header X-Real-IP \$remote_addr;
          proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto \$scheme;
        }
      }
EOF

# Deploy
eb deploy
```

### Google Cloud Platform (GCP)

#### Using Google Cloud Run

**1. Build and Deploy:**
```bash
# Set up gcloud
gcloud auth login
gcloud config set project your-project-id

# Build and push to Container Registry
gcloud builds submit --tag gcr.io/your-project-id/messaging-app-backend backend/
gcloud builds submit --tag gcr.io/your-project-id/messaging-app-frontend frontend/

# Deploy to Cloud Run
gcloud run deploy messaging-app-backend \
  --image gcr.io/your-project-id/messaging-app-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

gcloud run deploy messaging-app-frontend \
  --image gcr.io/your-project-id/messaging-app-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**2. Set up Cloud SQL:**
```bash
# Create PostgreSQL instance
gcloud sql instances create messaging-app-db \
  --database-version=POSTGRES_13 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database and user
gcloud sql databases create messaging_app_prod --instance=messaging-app-db
gcloud sql users create messaging_user --instance=messaging-app-db --password=your_secure_password
```

### Microsoft Azure

#### Using Azure Container Instances

**1. Create Resource Group:**
```bash
az group create --name messaging-app-rg --location eastus
```

**2. Create PostgreSQL Database:**
```bash
az postgres server create \
  --resource-group messaging-app-rg \
  --name messaging-app-db \
  --location eastus \
  --admin-user messaging_user \
  --admin-password your_secure_password \
  --sku-name B_Gen5_1
```

**3. Deploy Containers:**
```bash
# Create container group
az container create \
  --resource-group messaging-app-rg \
  --name messaging-app \
  --image your-registry/messaging-app-backend:latest \
  --dns-name-label messaging-app-backend \
  --ports 5000 \
  --environment-variables \
    NODE_ENV=production \
    DB_HOST=messaging-app-db.postgres.database.azure.com
```

## Traditional Server Deployment

### Ubuntu/Debian Server

#### System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Nginx
sudo apt install nginx

# Install PM2 for process management
sudo npm install -g pm2
```

#### Application Setup
```bash
# Create application user
sudo useradd -m -s /bin/bash messaging-app
sudo su - messaging-app

# Clone and set up application
git clone <repository-url> /home/messaging-app/app
cd /home/messaging-app/app

# Install dependencies and build
npm run install:all
npm run build:production

# Set up environment
cp backend/.env.production.example backend/.env.production
# Edit backend/.env.production with production values

# Set up database
sudo -u postgres createdb messaging_app_prod
sudo -u postgres createuser messaging_user
sudo -u postgres psql -c "ALTER USER messaging_user WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE messaging_app_prod TO messaging_user;"

# Run migrations
cd backend && npm run migrate
```

#### Process Management with PM2
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'messaging-app-backend',
      cwd: '/home/messaging-app/app/backend',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: '/home/messaging-app/logs/backend-error.log',
      out_file: '/home/messaging-app/logs/backend-out.log',
      log_file: '/home/messaging-app/logs/backend.log'
    }
  ]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Nginx Configuration
```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/messaging-app << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Serve React app
    location / {
        root /home/messaging-app/app/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Proxy Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/messaging-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### CentOS/RHEL Server

#### System Preparation
```bash
# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PostgreSQL
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install Nginx
sudo yum install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian
# OR
sudo yum install certbot python3-certbot-nginx  # CentOS/RHEL

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run

# Set up automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Manual SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Your application configuration here...
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Monitoring and Maintenance

### Health Checks

#### Application Health Check Endpoint
```javascript
// Add to backend routes
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

#### Monitoring Script
```bash
#!/bin/bash
# health-check.sh

BACKEND_URL="http://localhost:5000/api/health"
FRONTEND_URL="http://localhost:3000"

# Check backend health
if curl -f $BACKEND_URL > /dev/null 2>&1; then
    echo "✓ Backend is healthy"
else
    echo "❌ Backend is unhealthy"
    # Restart backend if needed
    pm2 restart messaging-app-backend
fi

# Check frontend
if curl -f $FRONTEND_URL > /dev/null 2>&1; then
    echo "✓ Frontend is healthy"
else
    echo "❌ Frontend is unhealthy"
    # Restart nginx if needed
    sudo systemctl restart nginx
fi
```

### Backup Strategy

#### Database Backup
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/home/messaging-app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/messaging_app_backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U messaging_user -d messaging_app_prod > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### Application Backup
```bash
#!/bin/bash
# backup-app.sh

APP_DIR="/home/messaging-app/app"
BACKUP_DIR="/home/messaging-app/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create application backup
tar -czf "$BACKUP_DIR/app_backup_$TIMESTAMP.tar.gz" \
    --exclude="node_modules" \
    --exclude="build" \
    --exclude="logs" \
    -C /home/messaging-app app

echo "Application backup completed: app_backup_$TIMESTAMP.tar.gz"
```

### Log Management

#### Log Rotation Configuration
```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/messaging-app << EOF
/home/messaging-app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 messaging-app messaging-app
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql -h localhost -U messaging_user -d messaging_app_prod -c "SELECT 1;"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### Application Issues
```bash
# Check PM2 processes
pm2 status
pm2 logs messaging-app-backend

# Check application logs
tail -f /home/messaging-app/logs/backend.log

# Restart application
pm2 restart messaging-app-backend
```

#### Nginx Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

#### Socket.IO Connection Issues
```bash
# Check if WebSocket connections are working
curl -I -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" -H "Sec-WebSocket-Version: 13" http://localhost:5000/socket.io/

# Check firewall settings
sudo ufw status
sudo iptables -L
```

### Performance Issues

#### Database Performance
```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check database connections
SELECT count(*) as connections, state
FROM pg_stat_activity
GROUP BY state;
```

#### Application Performance
```bash
# Check memory usage
pm2 monit

# Check system resources
htop
iostat -x 1

# Check Node.js heap usage
node --inspect backend/server.js
```

## Security Considerations

### Firewall Configuration
```bash
# Configure UFW (Ubuntu/Debian)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Configure firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Security Headers
```nginx
# Add to Nginx configuration
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Regular Security Updates
```bash
# Create update script
#!/bin/bash
# security-updates.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js packages
cd /home/messaging-app/app
npm audit fix

# Restart services
pm2 restart all
sudo systemctl reload nginx

echo "Security updates completed"
```

This comprehensive deployment guide covers all major deployment scenarios and provides detailed instructions for setting up, configuring, and maintaining the Real-time Messaging App in various environments.