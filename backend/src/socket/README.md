# Socket.IO Real-time Messaging Implementation

This directory contains the complete Socket.IO implementation for real-time messaging functionality in the messaging application.

## Overview

The Socket.IO implementation provides:
- **Authentication**: JWT-based authentication for Socket.IO connections
- **Real-time Messaging**: Instant message delivery between users
- **Room Management**: User-to-user conversation rooms
- **Typing Indicators**: Real-time typing status updates
- **Online Status**: User online/offline status tracking
- **Message Read Status**: Read receipts for messages
- **Connection Management**: Proper cleanup and error handling

## Architecture

### Files Structure

```
src/socket/
├── socketAuth.js       # Authentication middleware for Socket.IO
├── socketHandlers.js   # Core event handlers and business logic
├── socketManager.js    # Socket.IO server initialization and setup
└── README.md          # This documentation
```

### Components

#### 1. Socket Authentication (`socketAuth.js`)
- Validates JWT tokens from handshake auth or query parameters
- Verifies user existence in database
- Attaches user information to socket object
- Handles authentication errors gracefully

#### 2. Socket Handlers (`socketHandlers.js`)
- **Connection Management**: User connection/disconnection handling
- **Room Management**: Conversation room joining and management
- **Message Handling**: Real-time message sending and broadcasting
- **Typing Indicators**: Typing status management
- **Online Status**: Active user tracking
- **Read Receipts**: Message read status updates

#### 3. Socket Manager (`socketManager.js`)
- Initializes Socket.IO server with authentication
- Registers all event handlers
- Sets up error handling and logging

## Socket.IO Events

### Client to Server Events

| Event | Data | Description |
|-------|------|-------------|
| `join-room` | `{ contactId: number }` | Join a conversation room with a contact |
| `send-message` | `{ recipientId: number, content: string, messageType?: string }` | Send a message to another user |
| `typing` | `{ contactId: number, isTyping: boolean }` | Update typing status |
| `stop-typing` | `{ contactId: number }` | Stop typing (shorthand for typing: false) |
| `mark-as-read` | `{ messageId: number, senderId: number }` | Mark a message as read |

### Server to Client Events

| Event | Data | Description |
|-------|------|-------------|
| `message-received` | `MessageData` | New message from another user |
| `user-typing` | `TypingData` | Another user is typing |
| `user-online` | `UserStatusData` | User came online |
| `user-offline` | `UserStatusData` | User went offline |
| `online-users` | `UserData[]` | List of currently online users |
| `message-read` | `ReadReceiptData` | Message was read by recipient |
| `room-joined` | `{ roomName: string, contactId: number }` | Successfully joined room |
| `error` | `{ message: string }` | Error occurred |

### Data Types

```typescript
interface MessageData {
  id: number;
  senderId: number;
  senderName: string;
  recipientId: number;
  content: string;
  messageType: string;
  timestamp: string;
  readAt: string | null;
}

interface TypingData {
  userId: number;
  userName: string;
  contactId: number;
  isTyping: boolean;
  timestamp: string;
}

interface UserStatusData {
  userId: number;
  userName: string;
  timestamp: string;
}

interface UserData {
  userId: number;
  userName: string;
  lastSeen: string;
  isTyping: boolean;
}

interface ReadReceiptData {
  messageId: number;
  readAt: string;
  readBy: number;
}
```

## Authentication

### Connection Authentication

Socket.IO connections are authenticated using JWT tokens. Tokens can be provided in two ways:

1. **Handshake Auth** (Recommended):
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

2. **Query Parameters**:
```javascript
const socket = io('http://localhost:5000', {
  query: {
    token: 'your-jwt-token'
  }
});
```

### Authentication Flow

1. Client connects with JWT token
2. Server validates token using existing JWT utilities
3. Server verifies user exists in database
4. User information is attached to socket object
5. Connection is established or rejected

## Room Management

### Conversation Rooms

- Each conversation between two users has a unique room
- Room names follow the pattern: `conversation_{userId1}_{userId2}`
- User IDs are sorted to ensure consistent room names
- Users automatically join their personal room: `user_{userId}`

### Room Joining Flow

1. Client emits `join-room` with contact ID
2. Server creates consistent room name
3. Socket joins the conversation room
4. Server tracks room membership
5. Client receives `room-joined` confirmation

## Message Flow

### Sending Messages

1. Client emits `send-message` with recipient and content
2. Server validates message data and recipient
3. Message is saved to PostgreSQL database
4. Message is broadcast to conversation room
5. Message is also sent to recipient's personal room
6. Both sender and recipient receive `message-received` event

### Message Validation

- Recipient must exist in database
- Content cannot be empty (after trimming)
- Content cannot exceed 1000 characters
- Message type defaults to 'text'

## Online Status Tracking

### Active Users Management

- `activeUsers` Map stores online user information
- Tracks socket ID, username, last seen, and typing status
- Updated on connection, disconnection, and activity
- Provides real-time online/offline notifications

### Status Events

- `user-online`: Broadcast when user connects
- `user-offline`: Broadcast when user disconnects
- `online-users`: Sent to new connections with current online users

## Typing Indicators

### Typing Flow

1. Client emits `typing` with contact ID and typing status
2. Server updates user's typing status in memory
3. Server broadcasts `user-typing` to conversation room
4. Other users receive real-time typing updates

### Typing Management

- Typing status is stored in `activeUsers` Map
- Broadcasts to both conversation room and contact's personal room
- Supports both `typing` and `stop-typing` events

## Error Handling

### Connection Errors

- Invalid or missing tokens result in connection rejection
- Database errors during authentication are handled gracefully
- Connection errors are logged and reported

### Runtime Errors

- Invalid message data triggers error events
- Database errors during message operations are caught
- Socket errors are logged with user context

## Testing

### Test Coverage

The Socket.IO implementation includes comprehensive tests:

- **Unit Tests**: Individual handler functions
- **Integration Tests**: End-to-end Socket.IO communication
- **Authentication Tests**: Token validation and user verification
- **Manager Tests**: Server initialization and event registration

### Running Tests

```bash
# Run all Socket.IO tests
npm test -- --testPathPatterns=socket

# Run specific test files
npm test -- --testPathPatterns=socket-auth
npm test -- --testPathPatterns=socket-handlers
npm test -- --testPathPatterns=socket-manager
```

## Usage Examples

### Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('authToken')
  }
});

// Handle connection
socket.on('connect', () => {
  console.log('Connected to server');
});

// Handle authentication errors
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

### Joining a Conversation

```javascript
// Join conversation with user ID 123
socket.emit('join-room', { contactId: 123 });

socket.on('room-joined', (data) => {
  console.log(`Joined room: ${data.roomName}`);
});
```

### Sending Messages

```javascript
// Send a text message
socket.emit('send-message', {
  recipientId: 123,
  content: 'Hello there!',
  messageType: 'text'
});

// Listen for incoming messages
socket.on('message-received', (message) => {
  console.log('New message:', message);
});
```

### Typing Indicators

```javascript
// Start typing
socket.emit('typing', { contactId: 123, isTyping: true });

// Stop typing
socket.emit('stop-typing', { contactId: 123 });

// Listen for typing updates
socket.on('user-typing', (data) => {
  if (data.isTyping) {
    console.log(`${data.userName} is typing...`);
  } else {
    console.log(`${data.userName} stopped typing`);
  }
});
```

### Online Status

```javascript
// Listen for online status changes
socket.on('user-online', (data) => {
  console.log(`${data.userName} came online`);
});

socket.on('user-offline', (data) => {
  console.log(`${data.userName} went offline`);
});

// Get current online users (sent on connection)
socket.on('online-users', (users) => {
  console.log('Currently online:', users);
});
```

## Performance Considerations

### Memory Management

- Active users are stored in memory for fast access
- Connection cleanup removes users from memory
- Room membership is tracked efficiently

### Database Optimization

- Messages are saved to database immediately
- User last seen timestamps are updated on activity
- Database queries are optimized for conversation retrieval

### Scalability

- Room-based message delivery reduces unnecessary broadcasts
- Personal rooms ensure message delivery even if not in conversation room
- Connection management prevents memory leaks

## Security Considerations

### Authentication Security

- JWT tokens are validated on every connection
- User existence is verified in database
- Invalid tokens result in connection rejection

### Message Security

- All message content is validated and sanitized
- Recipient existence is verified before message delivery
- Room access is controlled by authentication

### Connection Security

- Rate limiting can be implemented at the Socket.IO level
- Connection errors are logged for monitoring
- User data is cleaned up on disconnection

## Integration with Main Server

The Socket.IO implementation is integrated into the main Express server:

```javascript
// In server.js
const { initializeSocket } = require('./src/socket/socketManager');

// Initialize Socket.IO with authentication and handlers
initializeSocket(io);
```

This provides a complete real-time messaging solution that integrates seamlessly with the existing REST API and database structure.