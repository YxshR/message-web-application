# Documentation Index

Welcome to the Real-time Messaging App documentation. This directory contains comprehensive guides and references for developers, system administrators, and users.

## 📚 Documentation Overview

### Getting Started
- **[Main README](../README.md)** - Project overview, quick start, and basic setup
- **[Installation Guide](../README.md#quick-start)** - Step-by-step installation instructions

### Development
- **[API Documentation](API.md)** - Complete REST API reference with examples
- **[Socket.IO Events](SOCKET_IO.md)** - Real-time communication events and usage
- **[Architecture Guide](ARCHITECTURE.md)** - System architecture and design patterns

### Deployment & Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment strategies and configurations
- **[Environment Configuration](DEPLOYMENT.md#environment-setup)** - Environment variables and settings

### Database
- **[Database Setup](../backend/DATABASE_SETUP.md)** - Database schema and migration instructions
- **[Migration Guide](../backend/src/migrations/README.md)** - Database migration procedures

### Testing
- **[Testing Guide](../TESTING.md)** - Test suite overview and execution instructions
- **[Performance Testing](../backend/src/tests/performance/)** - Load testing and performance benchmarks

## 🔧 Quick Reference

### Common Commands

```bash
# Development
npm run dev                    # Start development servers
npm run test                   # Run all tests
npm run test:coverage         # Run tests with coverage

# Production
npm run build:production      # Build for production
npm run deploy:production     # Deploy to production
npm run deploy:staging        # Deploy to staging

# Database
cd backend && npm run migrate # Run database migrations
cd backend && npm run seed    # Seed database with test data
cd backend && npm run db:test # Test database connection
```

### Environment Files

| File | Purpose | Required |
|------|---------|----------|
| `backend/.env` | Development backend config | Yes |
| `frontend/.env` | Development frontend config | Yes |
| `backend/.env.production` | Production backend config | Production only |
| `frontend/.env.production` | Production frontend config | Production only |
| `backend/.env.staging` | Staging backend config | Staging only |
| `frontend/.env.staging` | Staging frontend config | Staging only |

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | User authentication |
| `/api/auth/register` | POST | User registration |
| `/api/contacts` | GET | Get user contacts |
| `/api/messages/:contactId` | GET | Get conversation messages |
| `/api/messages` | POST | Send message |
| `/api/health` | GET | Health check |

### Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `send-message` | Client → Server | Send message |
| `message-received` | Server → Client | Receive message |
| `typing` | Client → Server | Start typing |
| `user-typing` | Server → Client | User typing notification |
| `join-room` | Client → Server | Join user room |

## 📖 Detailed Guides

### For Developers

1. **[API Documentation](API.md)**
   - Authentication endpoints
   - Contact management
   - Message handling
   - Error responses
   - Rate limiting

2. **[Socket.IO Events](SOCKET_IO.md)**
   - Connection management
   - Real-time messaging
   - Typing indicators
   - Presence tracking
   - Best practices

3. **[Architecture Guide](ARCHITECTURE.md)**
   - System overview
   - Component architecture
   - Database design
   - Security architecture
   - Performance considerations

### For System Administrators

1. **[Deployment Guide](DEPLOYMENT.md)**
   - Environment setup
   - Docker deployment
   - Cloud platform deployment
   - Traditional server deployment
   - SSL/TLS configuration
   - Monitoring and maintenance

2. **[Security Configuration](DEPLOYMENT.md#security-considerations)**
   - Firewall setup
   - Security headers
   - Regular updates
   - Backup strategies

### For DevOps Engineers

1. **[CI/CD Pipeline](../.github/workflows/ci.yml)**
   - Automated testing
   - Build processes
   - Deployment automation

2. **[Monitoring Setup](DEPLOYMENT.md#monitoring-and-maintenance)**
   - Health checks
   - Log management
   - Performance monitoring
   - Alerting

## 🛠️ Development Workflow

### Setting Up Development Environment

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd realtime-messaging-app
   npm run install:all
   ```

2. **Configure Environment**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   # Edit .env files with your configuration
   ```

3. **Set Up Database**
   ```bash
   createdb messaging_app_dev
   cd backend && npm run db:setup
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

### Testing Workflow

1. **Run Tests**
   ```bash
   npm test                    # All tests
   npm run test:backend       # Backend only
   npm run test:frontend      # Frontend only
   npm run test:e2e          # End-to-end tests
   ```

2. **Coverage Reports**
   ```bash
   npm run test:coverage
   ```

3. **Performance Tests**
   ```bash
   npm run test:performance
   ```

### Deployment Workflow

1. **Staging Deployment**
   ```bash
   npm run deploy:staging
   ```

2. **Production Deployment**
   ```bash
   npm run deploy:production
   ```

3. **Rollback (if needed)**
   ```bash
   ./scripts/deploy.sh rollback
   ```

## 🔍 Troubleshooting

### Common Issues

| Issue | Solution | Reference |
|-------|----------|-----------|
| Database connection fails | Check PostgreSQL service and credentials | [Database Setup](../backend/DATABASE_SETUP.md) |
| Socket.IO not connecting | Verify CORS settings and firewall | [Socket.IO Guide](SOCKET_IO.md) |
| Build fails | Clear node_modules and reinstall | [Deployment Guide](DEPLOYMENT.md#troubleshooting) |
| Tests failing | Check test database setup | [Testing Guide](../TESTING.md) |

### Getting Help

1. **Check Documentation** - Review relevant guides above
2. **Check Logs** - Application and system logs for error details
3. **Run Health Checks** - Use built-in health check endpoints
4. **Create Issue** - Submit detailed bug reports with logs

## 📋 Checklists

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates valid
- [ ] Backup strategy in place
- [ ] Monitoring configured

### Security Checklist

- [ ] JWT secrets are secure and unique
- [ ] Database credentials are strong
- [ ] HTTPS/WSS enabled
- [ ] Firewall configured
- [ ] Security headers set
- [ ] Regular updates scheduled

### Performance Checklist

- [ ] Database indexes optimized
- [ ] Caching configured
- [ ] Compression enabled
- [ ] CDN configured (if applicable)
- [ ] Load testing completed
- [ ] Monitoring thresholds set

## 📞 Support

For additional support:

- **Documentation Issues**: Update this documentation
- **Bug Reports**: Create GitHub issues with detailed information
- **Feature Requests**: Submit enhancement proposals
- **Security Issues**: Report privately to maintainers

## 📝 Contributing to Documentation

To improve this documentation:

1. **Identify gaps** in current documentation
2. **Create or update** relevant markdown files
3. **Test instructions** to ensure accuracy
4. **Submit pull request** with clear description
5. **Update this index** if adding new documents

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Provide step-by-step instructions
- Add troubleshooting sections
- Keep information up-to-date
- Use consistent formatting

---

**Last Updated**: $(date +%Y-%m-%d)
**Version**: 1.0.0