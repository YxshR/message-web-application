# Socket.IO Events Documentation

## Overview

The Real-time Messaging App uses Socket.IO for real-time communication between clients and the server. This document describes all available events, their payloads, and usage patterns.

**Connection URL:** `http://localhost:5000` (development) or `https://yourdomain.com` (production)

## Connection & Authentication

### Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token_here'
  },
  transports: ['websocket', 'polling']
});
```

### Authentication

All Socket.IO connections must be authenticated with a valid JWT token. The token should be provided in the `auth` object during connection or sent with the `authenticate` event.

**Event:** `authenticate`
```javascript
socket.emit('authenticate', {
  token: 'your_jwt_token_here'
});
```

**Response:** `authenticated`
```javascript
socket.on('authenticated', (data) => {
  console.log('Authentication successful:', data.user);
});
```

**Error:** `authentication_error`
```javascript
socket.on('authentication_error', (error) => {
  console.error('Authentication failed:', error.message);
});
```

## Room Management

### Join User Room

**Event:** `join-room`

**Description:** Join the user's personal room to receive messages and notifications

**Client to Server:**
```javascript
socket.emit('join-room');
```

**Server Response:** `room-joined`
```javascript
socket.on('room-joined', (data) => {
  console.log('Joined room:', data.roomId);
  // data = { roomId: 'user_123', userId: 123 }
});
```

### Leave Room

**Event:** `leave-room`

**Description:** Leave the current room (automatically called on disconnect)

**Client to Server:**
```javascript
socket.emit('leave-room');
```

## Messaging Events

### Send Message

**Event:** `send-message`

**Description:** Send a message to another user

**Client to Server:**
```javascript
socket.emit('send-message', {
  recipientId: 456,
  content: 'Hello there!',
  messageType: 'text', // 'text', 'image', 'file'
  tempId: 'temp_123' // Optional client-generated ID for tracking
});
```

**Server Response:** `message-sent`
```javascript
socket.on('message-sent', (data) => {
  console.log('Message sent successfully:', data);
  // data = {
  //   message: {
  //     id: 789,
  //     senderId: 123,
  //     recipientId: 456,
  //     content: 'Hello there!',
  //     timestamp: '2024-01-15T10:30:00Z',
  //     messageType: 'text'
  //   },
  //   tempId: 'temp_123'
  // }
});
```

**Error:** `message-error`
```javascript
socket.on('message-error', (error) => {
  console.error('Failed to send message:', error);
  // error = {
  //   code: 'RECIPIENT_NOT_FOUND',
  //   message: 'Recipient user not found',
  //   tempId: 'temp_123'
  // }
});
```

### Receive Message

**Event:** `message-received`

**Description:** Receive a new message from another user

**Server to Client:**
```javascript
socket.on('message-received', (data) => {
  console.log('New message received:', data);
  // data = {
  //   message: {
  //     id: 790,
  //     senderId: 456,
  //     recipientId: 123,
  //     content: 'Hi back!',
  //     timestamp: '2024-01-15T10:31:00Z',
  //     messageType: 'text'
  //   },
  //   sender: {
  //     id: 456,
  //     name: 'Jane Smith',
  //     email: 'jane@example.com'
  //   }
  // }
});
```

### Message Status Updates

**Event:** `message-delivered`

**Description:** Notification that a message was delivered to the recipient

**Server to Client:**
```javascript
socket.on('message-delivered', (data) => {
  console.log('Message delivered:', data);
  // data = {
  //   messageId: 789,
  //   recipientId: 456,
  //   deliveredAt: '2024-01-15T10:30:05Z'
  // }
});
```

**Event:** `message-read`

**Description:** Notification that a message was read by the recipient

**Server to Client:**
```javascript
socket.on('message-read', (data) => {
  console.log('Message read:', data);
  // data = {
  //   messageId: 789,
  //   recipientId: 456,
  //   readAt: '2024-01-15T10:32:00Z'
  // }
});
```

### Mark Messages as Read

**Event:** `mark-messages-read`

**Description:** Mark messages from a specific sender as read

**Client to Server:**
```javascript
socket.emit('mark-messages-read', {
  senderId: 456
});
```

## Typing Indicators

### Start Typing

**Event:** `typing`

**Description:** Indicate that the user is typing a message

**Client to Server:**
```javascript
socket.emit('typing', {
  recipientId: 456
});
```

**Server to Recipient:** `user-typing`
```javascript
socket.on('user-typing', (data) => {
  console.log('User is typing:', data);
  // data = {
  //   userId: 123,
  //   userName: 'John Doe'
  // }
});
```

### Stop Typing

**Event:** `stop-typing`

**Description:** Indicate that the user stopped typing

**Client to Server:**
```javascript
socket.emit('stop-typing', {
  recipientId: 456
});
```

**Server to Recipient:** `user-stopped-typing`
```javascript
socket.on('user-stopped-typing', (data) => {
  console.log('User stopped typing:', data);
  // data = {
  //   userId: 123,
  //   userName: 'John Doe'
  // }
});
```

## Presence Events

### User Online Status

**Event:** `user-online`

**Description:** Notification when a contact comes online

**Server to Client:**
```javascript
socket.on('user-online', (data) => {
  console.log('User came online:', data);
  // data = {
  //   userId: 456,
  //   userName: 'Jane Smith',
  //   lastSeen: '2024-01-15T10:30:00Z'
  // }
});
```

**Event:** `user-offline`

**Description:** Notification when a contact goes offline

**Server to Client:**
```javascript
socket.on('user-offline', (data) => {
  console.log('User went offline:', data);
  // data = {
  //   userId: 456,
  //   userName: 'Jane Smith',
  //   lastSeen: '2024-01-15T10:35:00Z'
  // }
});
```

### Get Online Users

**Event:** `get-online-users`

**Description:** Request list of online contacts

**Client to Server:**
```javascript
socket.emit('get-online-users');
```

**Server Response:** `online-users`
```javascript
socket.on('online-users', (data) => {
  console.log('Online users:', data);
  // data = {
  //   users: [
  //     { userId: 456, userName: 'Jane Smith', lastSeen: '2024-01-15T10:30:00Z' },
  //     { userId: 789, userName: 'Bob Johnson', lastSeen: '2024-01-15T10:25:00Z' }
  //   ]
  // }
});
```

## Connection Events

### Connection Established

**Event:** `connect`

**Description:** Socket.IO connection established

```javascript
socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
});
```

### Connection Error

**Event:** `connect_error`

**Description:** Connection failed or authentication error

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

### Disconnection

**Event:** `disconnect`

**Description:** Socket.IO connection lost

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Server disconnected the client, reconnect manually
    socket.connect();
  }
  // Otherwise, reconnection will be automatic
});
```

### Reconnection

**Event:** `reconnect`

**Description:** Successfully reconnected to server

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  
  // Re-authenticate and rejoin room
  socket.emit('authenticate', { token: getStoredToken() });
});
```

## Error Handling

### General Error Event

**Event:** `error`

**Description:** General error from server

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // error = {
  //   code: 'ERROR_CODE',
  //   message: 'Error description',
  //   details: { ... }
  // }
});
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED` - No valid authentication provided
- `INVALID_TOKEN` - JWT token is invalid or expired
- `USER_NOT_FOUND` - Referenced user does not exist
- `RECIPIENT_NOT_FOUND` - Message recipient not found
- `RATE_LIMIT_EXCEEDED` - Too many events sent too quickly
- `INVALID_PAYLOAD` - Event payload is malformed
- `PERMISSION_DENIED` - User lacks permission for action

## Rate Limiting

Socket.IO events are rate limited to prevent spam:

- **Messages**: 60 per minute per user
- **Typing events**: 10 per minute per conversation
- **Presence updates**: 5 per minute per user

When rate limit is exceeded, an error event is emitted:

```javascript
socket.on('error', (error) => {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Rate limit exceeded, please slow down');
  }
});
```

## Best Practices

### Connection Management

```javascript
class SocketManager {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.socket = io('http://localhost:5000', {
      auth: { token: this.token },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
      this.socket.emit('join-room');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.socket.disconnect();
      }
    });
  }

  sendMessage(recipientId, content) {
    if (this.socket && this.socket.connected) {
      const tempId = `temp_${Date.now()}`;
      this.socket.emit('send-message', {
        recipientId,
        content,
        tempId
      });
      return tempId;
    }
    throw new Error('Socket not connected');
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

### Message Handling

```javascript
// Handle message sending with optimistic updates
function sendMessage(content, recipientId) {
  const tempId = `temp_${Date.now()}`;
  
  // Optimistically add message to UI
  addMessageToUI({
    tempId,
    content,
    senderId: currentUserId,
    recipientId,
    timestamp: new Date().toISOString(),
    status: 'sending'
  });

  // Send via socket
  socket.emit('send-message', {
    recipientId,
    content,
    tempId
  });
}

// Handle successful send
socket.on('message-sent', (data) => {
  updateMessageInUI(data.tempId, {
    id: data.message.id,
    status: 'sent',
    timestamp: data.message.timestamp
  });
});

// Handle send error
socket.on('message-error', (error) => {
  updateMessageInUI(error.tempId, {
    status: 'failed',
    error: error.message
  });
});
```

### Typing Indicators

```javascript
let typingTimer;
const TYPING_TIMEOUT = 3000; // 3 seconds

function handleTyping(recipientId) {
  // Send typing event
  socket.emit('typing', { recipientId });
  
  // Clear existing timer
  clearTimeout(typingTimer);
  
  // Set timer to stop typing
  typingTimer = setTimeout(() => {
    socket.emit('stop-typing', { recipientId });
  }, TYPING_TIMEOUT);
}

// Stop typing when user stops typing or sends message
function stopTyping(recipientId) {
  clearTimeout(typingTimer);
  socket.emit('stop-typing', { recipientId });
}
```