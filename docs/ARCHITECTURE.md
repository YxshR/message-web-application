# Architecture Documentation

## Overview

The Real-time Messaging App follows a modern full-stack architecture designed for scalability, maintainability, and real-time performance. The system is built using a client-server model with clear separation of concerns and well-defined interfaces.

## System Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        A[Web Browser]
        B[Mobile Browser]
    end
    
    subgraph "Load Balancer/Proxy"
        C[Nginx]
    end
    
    subgraph "Frontend Layer"
        D[React App]
        E[Static Assets]
    end
    
    subgraph "Backend Layer"
        F[Express.js API]
        G[Socket.IO Server]
        H[Authentication Middleware]
        I[Rate Limiting]
    end
    
    subgraph "Data Layer"
        J[(PostgreSQL)]
        K[Connection Pool]
    end
    
    subgraph "External Services"
        L[Email Service]
        M[File Storage]
        N[Monitoring]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    
    D --> F
    D --> G
    
    F --> H
    F --> I
    F --> K
    G --> K
    K --> J
    
    F --> L
    F --> M
    F --> N
```

## Component Architecture

### Frontend Architecture

The frontend follows a component-based architecture using React with the following patterns:

#### Component Hierarchy
```
App
├── AuthProvider
├── SocketProvider
├── ToastProvider
├── Router
    ├── LoginPage
    ├── RegisterPage
    └── MainLayout
        ├── Sidebar
        │   ├── ChatTab
        │   └── ContactsTab
        ├── TopBar
        └── MainContent
            ├── ChatInterface
            │   ├── MessageList
            │   ├── MessageInput
            │   └── TypingIndicator
            └── ContactsPage
                ├── ContactsList
                ├── ContactsSearch
                └── AddContactModal
```

#### State Management
- **React Context**: Global state management for authentication, socket connection, and UI state
- **Local State**: Component-specific state using useState and useReducer hooks
- **Custom Hooks**: Reusable logic for common operations (useSocket, useAuth, useMessages)

#### Data Flow
```mermaid
graph LR
    A[User Action] --> B[Component]
    B --> C[Context/Hook]
    C --> D[API Service]
    D --> E[Backend API]
    E --> F[Database]
    
    G[Socket Event] --> H[Socket Context]
    H --> I[Component Update]
    I --> J[UI Re-render]
```

### Backend Architecture

The backend follows a layered architecture with clear separation of concerns:

#### Layer Structure
```
Presentation Layer (Routes)
├── Authentication Routes
├── User Routes
├── Contact Routes
├── Message Routes
└── Socket.IO Handlers

Business Logic Layer (Services)
├── Authentication Service
├── User Service
├── Contact Service
├── Message Service
└── Socket Service

Data Access Layer (Repositories)
├── User Repository
├── Contact Repository
├── Message Repository
└── Database Connection Pool

Infrastructure Layer
├── Database Configuration
├── JWT Utilities
├── Password Hashing
├── Error Handling
└── Logging
```

#### Request Flow
```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant R as Route Handler
    participant S as Service
    participant D as Database
    
    C->>M: HTTP Request
    M->>M: Authentication
    M->>M: Rate Limiting
    M->>R: Validated Request
    R->>S: Business Logic
    S->>D: Data Operation
    D->>S: Result
    S->>R: Processed Data
    R->>C: HTTP Response
```

## Database Architecture

### Schema Design

The database follows a normalized relational design optimized for messaging applications:

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts relationship table
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id)
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    message_type VARCHAR(20) DEFAULT 'text'
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON messages(sender_id, recipient_id, created_at);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_contacts_user ON contacts(user_id);
```

### Database Relationships

```mermaid
erDiagram
    USERS ||--o{ CONTACTS : has
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ MESSAGES : receives
    
    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        timestamp created_at
        timestamp updated_at
        timestamp last_seen
    }
    
    CONTACTS {
        int id PK
        int user_id FK
        int contact_user_id FK
        timestamp created_at
    }
    
    MESSAGES {
        int id PK
        int sender_id FK
        int recipient_id FK
        text content
        timestamp created_at
        timestamp read_at
        string message_type
    }
```

## Real-time Communication Architecture

### Socket.IO Implementation

The real-time communication is built using Socket.IO with the following architecture:

#### Connection Management
```mermaid
graph TB
    A[Client Connection] --> B[Authentication Check]
    B --> C{Valid Token?}
    C -->|Yes| D[Join User Room]
    C -->|No| E[Reject Connection]
    D --> F[Store Connection]
    F --> G[Emit Online Status]
    
    H[Client Disconnect] --> I[Leave Rooms]
    I --> J[Update Last Seen]
    J --> K[Emit Offline Status]
```

#### Message Flow
```mermaid
sequenceDiagram
    participant S as Sender Client
    participant SS as Socket Server
    participant DB as Database
    participant RS as Recipient Socket
    participant R as Recipient Client
    
    S->>SS: send-message
    SS->>DB: Save Message
    DB->>SS: Message Saved
    SS->>S: message-sent
    SS->>RS: message-received
    RS->>R: Display Message
    R->>RS: mark-read
    RS->>DB: Update Read Status
    DB->>RS: Updated
    RS->>S: message-read
```

#### Room Management
- **User Rooms**: Each user joins a room named `user_${userId}` for receiving messages
- **Typing Rooms**: Temporary rooms for typing indicators between specific users
- **Presence Tracking**: Global tracking of online/offline status

## Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    A[Login Request] --> B[Validate Credentials]
    B --> C[Generate JWT Token]
    C --> D[Set HTTP-Only Cookie]
    D --> E[Return User Data]
    
    F[API Request] --> G[Extract JWT Token]
    G --> H[Validate Token]
    H --> I{Valid?}
    I -->|Yes| J[Allow Request]
    I -->|No| K[Return 401]
    
    L[Socket Connection] --> M[Check JWT in Auth]
    M --> N{Valid?}
    N -->|Yes| O[Allow Connection]
    N -->|No| P[Reject Connection]
```

### Security Layers

1. **Transport Security**: HTTPS/WSS encryption
2. **Authentication**: JWT tokens with secure generation
3. **Authorization**: Role-based access control
4. **Input Validation**: Comprehensive input sanitization
5. **Rate Limiting**: Request throttling and abuse prevention
6. **CORS Protection**: Strict origin validation
7. **SQL Injection Prevention**: Parameterized queries
8. **XSS Protection**: Content Security Policy headers

## Performance Architecture

### Optimization Strategies

#### Frontend Performance
- **Code Splitting**: Dynamic imports for route-based splitting
- **Virtual Scrolling**: Efficient rendering of large message lists
- **Memoization**: React.memo and useMemo for expensive operations
- **Lazy Loading**: Progressive loading of message history
- **Caching**: Browser caching for static assets

#### Backend Performance
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Indexed queries and pagination
- **Caching**: In-memory caching for frequently accessed data
- **Compression**: Gzip compression for API responses
- **Rate Limiting**: Prevent resource exhaustion

#### Database Performance
- **Indexing Strategy**: Optimized indexes for query patterns
- **Pagination**: Limit result sets for large datasets
- **Connection Pooling**: Manage database connections efficiently
- **Query Optimization**: Efficient SQL queries with proper joins

### Scalability Considerations

#### Horizontal Scaling
```mermaid
graph TB
    A[Load Balancer] --> B[App Server 1]
    A --> C[App Server 2]
    A --> D[App Server N]
    
    B --> E[Database Cluster]
    C --> E
    D --> E
    
    F[Redis Cluster] --> B
    F --> C
    F --> D
```

#### Vertical Scaling
- **Resource Optimization**: CPU and memory usage optimization
- **Database Tuning**: PostgreSQL configuration optimization
- **Caching Layers**: Multiple levels of caching

## Deployment Architecture

### Production Environment

```mermaid
graph TB
    subgraph "CDN/Edge"
        A[CloudFlare/AWS CloudFront]
    end
    
    subgraph "Load Balancer"
        B[Nginx/AWS ALB]
    end
    
    subgraph "Application Tier"
        C[Frontend Container]
        D[Backend Container 1]
        E[Backend Container 2]
    end
    
    subgraph "Database Tier"
        F[PostgreSQL Primary]
        G[PostgreSQL Replica]
    end
    
    subgraph "Monitoring"
        H[Logging Service]
        I[Metrics Collection]
        J[Health Checks]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    
    D --> F
    E --> F
    D --> G
    E --> G
    
    C --> H
    D --> H
    E --> H
    
    I --> D
    I --> E
    I --> F
    
    J --> D
    J --> E
    J --> F
```

### Container Architecture

#### Docker Containers
- **Frontend Container**: Nginx serving React build
- **Backend Container**: Node.js application
- **Database Container**: PostgreSQL with persistent volumes
- **Reverse Proxy**: Nginx for routing and SSL termination

#### Container Orchestration
- **Docker Compose**: Development and simple production deployments
- **Kubernetes**: Advanced production deployments with auto-scaling
- **Health Checks**: Container health monitoring and restart policies

## Monitoring and Observability

### Logging Architecture
```mermaid
graph LR
    A[Application Logs] --> B[Log Aggregation]
    C[Access Logs] --> B
    D[Error Logs] --> B
    E[Database Logs] --> B
    
    B --> F[Log Storage]
    F --> G[Log Analysis]
    G --> H[Alerting]
```

### Metrics Collection
- **Application Metrics**: Response times, error rates, throughput
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Query performance, connection counts
- **Business Metrics**: User activity, message volume

### Health Checks
- **Application Health**: API endpoint health checks
- **Database Health**: Connection and query health
- **Socket Health**: WebSocket connection monitoring
- **External Dependencies**: Third-party service health

## Development Architecture

### Development Workflow
```mermaid
graph LR
    A[Local Development] --> B[Git Commit]
    B --> C[CI Pipeline]
    C --> D[Automated Tests]
    D --> E[Build & Package]
    E --> F[Deploy to Staging]
    F --> G[Integration Tests]
    G --> H[Deploy to Production]
```

### Environment Strategy
- **Development**: Local development with hot reloading
- **Staging**: Production-like environment for testing
- **Production**: Live environment with monitoring and backups

### Code Organization
```
src/
├── components/          # React components
│   ├── common/         # Shared components
│   ├── pages/          # Page components
│   └── layout/         # Layout components
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── services/           # API and external services
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── __tests__/          # Test files
```

## Future Architecture Considerations

### Microservices Migration
- **Service Decomposition**: Split monolith into focused services
- **API Gateway**: Centralized API management
- **Service Discovery**: Dynamic service location
- **Inter-service Communication**: Message queues and event streaming

### Advanced Features
- **File Sharing**: Media upload and sharing capabilities
- **Push Notifications**: Mobile and web push notifications
- **Video/Voice Calls**: WebRTC integration
- **Message Encryption**: End-to-end encryption
- **Multi-tenancy**: Support for multiple organizations

### Performance Enhancements
- **Caching Layer**: Redis for session and data caching
- **Message Queues**: Asynchronous processing with RabbitMQ/Kafka
- **CDN Integration**: Global content delivery
- **Database Sharding**: Horizontal database partitioning