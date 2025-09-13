# Real-time Messaging App

A full-stack real-time messaging application built with React, Node.js, Express, PostgreSQL, and Socket.IO. This application provides WhatsApp-style messaging functionality with real-time communication capabilities, user authentication, contact management, and persistent message storage.

## 🚀 Features

- **Real-time Messaging**: Instant message delivery using Socket.IO WebSockets
- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Contact Management**: Add, search, and manage contacts with real-time status updates
- **WhatsApp-style Interface**: Modern chat UI with message alignment and timestamps
- **Message History**: Persistent message storage with pagination and search
- **Typing Indicators**: Real-time typing status and online/offline presence
- **Responsive Design**: Mobile-first design that works on all devices
- **Performance Optimized**: Virtual scrolling, message search, and keyboard shortcuts
- **Comprehensive Testing**: Unit, integration, and end-to-end test coverage

## 📁 Project Structure

```
realtime-messaging-app/
├── frontend/                    # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── contexts/          # React contexts for state management
│   │   ├── services/          # API and Socket.IO services
│   │   ├── hooks/             # Custom React hooks
│   │   └── utils/             # Utility functions
│   ├── cypress/               # End-to-end tests
│   └── public/                # Static assets
├── backend/                     # Node.js Express backend
│   ├── src/
│   │   ├── routes/            # API route handlers
│   │   ├── middleware/        # Express middleware
│   │   ├── socket/            # Socket.IO handlers
│   │   ├── config/            # Configuration files
│   │   ├── migrations/        # Database migrations
│   │   ├── seeds/             # Database seed data
│   │   └── tests/             # Backend tests
│   └── server.js              # Main server file
├── scripts/                     # Build and deployment scripts
├── .github/workflows/          # CI/CD workflows
├── docker-compose.prod.yml     # Production Docker setup
├── Dockerfile.frontend         # Frontend Docker configuration
├── Dockerfile.backend          # Backend Docker configuration
├── nginx.conf                  # Nginx configuration
└── package.json               # Root package.json with scripts
```

## 🛠️ Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**
- **Docker** (optional, for containerized deployment)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd realtime-messaging-app

# Install all dependencies
npm run install:all
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb messaging_app_dev

# Set up database schema and seed data
cd backend
npm run db:setup
```

### 3. Environment Configuration

**Backend Environment:**
```bash
# Copy and configure backend environment
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=messaging_app_dev
DB_USER=your_username
DB_PASSWORD=your_password
JWT_SECRET=your_super_secure_jwt_secret_key_here
```

**Frontend Environment:**
```bash
# Copy and configure frontend environment
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:
```env
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
```

### 4. Start Development

```bash
# Run both frontend and backend
npm run dev

# Or run separately:
npm run dev:backend  # Backend only (http://localhost:5000)
npm run dev:frontend # Frontend only (http://localhost:3000)
```

## 🏗️ Production Deployment

### Option 1: Docker Deployment (Recommended)

```bash
# 1. Set up production environment variables
cp backend/.env.production.example backend/.env.production
cp frontend/.env.production.example frontend/.env.production

# 2. Configure production settings
# Edit .env.production files with your production values

# 3. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 4. Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate
```

### Option 2: Manual Deployment

```bash
# 1. Install dependencies and build
npm run deploy:setup

# 2. Set up production database
npm run deploy:migrate
npm run deploy:seed

# 3. Start production servers
npm run start:backend &
npm run start:frontend
```

### Option 3: Cloud Deployment

For cloud platforms like Heroku, AWS, or DigitalOcean:

1. **Set environment variables** in your cloud platform
2. **Configure build commands**:
   - Build command: `npm run build:production`
   - Start command: `npm start`
3. **Set up PostgreSQL** database service
4. **Configure domain** and SSL certificates

## 🧪 Testing

### Run All Tests
```bash
npm test                    # Basic test suite
npm run test:all           # Full test suite with performance and e2e
npm run test:coverage      # Test coverage report
```

### Specific Test Types
```bash
# Backend tests
npm run test:backend       # Unit and integration tests
npm run test:integration   # Integration tests only
npm run test:performance   # Performance and load tests

# Frontend tests
npm run test:frontend      # React component tests
npm run test:e2e          # Cypress end-to-end tests
```

### Test Coverage Goals
- **Backend**: 80% minimum coverage
- **Frontend**: 70% minimum coverage
- **Critical paths**: 95% coverage (authentication, messaging)

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | `{ name, email, password }` |
| POST | `/api/auth/login` | User login | `{ email, password }` |
| POST | `/api/auth/logout` | User logout | - |

### Contact Endpoints

| Method | Endpoint | Description | Headers |
|--------|----------|-------------|---------|
| GET | `/api/contacts` | Get user contacts | `Authorization: Bearer <token>` |
| POST | `/api/contacts` | Add new contact | `Authorization: Bearer <token>` |

### Message Endpoints

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/messages/:contactId` | Get conversation | `?page=1&limit=50` |
| POST | `/api/messages` | Send message | - |

### Socket.IO Events

**Client to Server:**
- `join-room` - Join user's personal room
- `send-message` - Send message to user
- `typing` - Start typing indicator
- `stop-typing` - Stop typing indicator

**Server to Client:**
- `message-received` - New message received
- `user-typing` - User is typing
- `user-stopped-typing` - User stopped typing
- `user-online` - User came online
- `user-offline` - User went offline

## 🔧 Configuration

### Environment Variables

**Backend Configuration:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5000)
- `DB_*` - Database connection settings
- `JWT_SECRET` - JWT signing secret
- `CORS_ORIGIN` - Allowed CORS origins

**Frontend Configuration:**
- `REACT_APP_API_BASE_URL` - Backend API URL
- `REACT_APP_SOCKET_URL` - Socket.IO server URL
- `REACT_APP_ENVIRONMENT` - Environment name

### Database Configuration

The application uses PostgreSQL with the following tables:
- **users** - User accounts and authentication
- **contacts** - User contact relationships
- **messages** - Chat messages with timestamps

See `backend/src/migrations/` for complete schema definitions.

## 🔒 Security Features

- **JWT Authentication** with HTTP-only cookies
- **Password Hashing** using bcrypt
- **Rate Limiting** on API endpoints
- **CORS Protection** with configurable origins
- **Input Validation** and sanitization
- **SQL Injection Prevention** with parameterized queries
- **XSS Protection** with security headers

## 🚀 Performance Optimizations

- **Virtual Scrolling** for large message lists
- **Message Pagination** with infinite scroll
- **Connection Pooling** for database efficiency
- **Gzip Compression** for static assets
- **Caching Headers** for optimal loading
- **Bundle Splitting** for faster initial loads

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors:**
```bash
# Test database connection
cd backend && npm run db:test

# Reset database
npm run migrate:rollback && npm run db:setup
```

**Port Already in Use:**
```bash
# Kill processes on ports 3000 and 5000
npx kill-port 3000 5000
```

**Socket.IO Connection Issues:**
- Check CORS configuration in backend
- Verify Socket.IO URL in frontend environment
- Ensure firewall allows WebSocket connections

**Build Failures:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules frontend/node_modules backend/node_modules
npm run install:all
```

### Logs and Debugging

**Backend Logs:**
```bash
# Development logs
cd backend && npm run dev

# Production logs
tail -f logs/app.log
```

**Frontend Debugging:**
- Open browser DevTools
- Check Network tab for API calls
- Monitor Console for errors
- Use React DevTools extension

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Run tests**: `npm test`
4. **Commit changes**: `git commit -m 'Add amazing feature'`
5. **Push to branch**: `git push origin feature/amazing-feature`
6. **Open Pull Request**

### Development Guidelines

- Follow existing code style and conventions
- Write tests for new features
- Update documentation for API changes
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- **Issues**: Create a GitHub issue
- **Documentation**: Check the `/docs` folder
- **API Reference**: See API documentation above

## 🔄 Changelog

### v1.0.0
- Initial release with core messaging functionality
- User authentication and contact management
- Real-time messaging with Socket.IO
- WhatsApp-style chat interface
- Comprehensive test suite
- Production deployment configurations