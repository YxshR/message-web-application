const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { pool } = require('../config/database');
const { generateAccessToken } = require('../utils/jwt');
const { initializeSocket } = require('../socket/socketManager');

describe('Socket.IO Integration Tests', () => {
  let io, serverSocket, clientSocket1, clientSocket2;
  let testUser1, testUser2;
  let token1, token2;
  let httpServer;

  beforeAll(async () => {
    // Create test server
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Initialize Socket.IO with our handlers
    initializeSocket(io);
    
    // Start server on random port
    await new Promise((resolve) => {
      httpServer.listen(() => {
        resolve();
      });
    });

    // Create test users
    const hashedPassword = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHFu'; // 'password123'
    
    const user1Result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User 1', 'test1@example.com', hashedPassword]
    );
    testUser1 = user1Result.rows[0];
    token1 = generateAccessToken({ userId: testUser1.id });

    const user2Result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User 2', 'test2@example.com', hashedPassword]
    );
    testUser2 = user2Result.rows[0];
    token2 = generateAccessToken({ userId: testUser2.id });
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM messages WHERE sender_id IN ($1, $2) OR recipient_id IN ($1, $2)', [testUser1.id, testUser2.id]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser1.id, testUser2.id]);
    
    // Close server
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach((done) => {
    const port = httpServer.address().port;
    
    // Create socket clients
    clientSocket1 = new Client(`http://localhost:${port}`, {
      auth: { token: token1 }
    });

    clientSocket2 = new Client(`http://localhost:${port}`, {
      auth: { token: token2 }
    });

    let connectedCount = 0;
    const checkConnected = () => {
      connectedCount++;
      if (connectedCount === 2) {
        done();
      }
    };

    clientSocket1.on('connect', checkConnected);
    clientSocket2.on('connect', checkConnected);
  });

  afterEach(() => {
    if (clientSocket1) {
      clientSocket1.disconnect();
    }
    if (clientSocket2) {
      clientSocket2.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      const port = httpServer.address().port;
      const unauthorizedClient = new Client(`http://localhost:${port}`);
      
      unauthorizedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication token required');
        unauthorizedClient.disconnect();
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const port = httpServer.address().port;
      const unauthorizedClient = new Client(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' }
      });
      
      unauthorizedClient.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid access token');
        unauthorizedClient.disconnect();
        done();
      });
    });

    it('should accept connection with valid token', () => {
      expect(clientSocket1.connected).toBe(true);
      expect(clientSocket2.connected).toBe(true);
    });
  });

  describe('Online Status', () => {
    it('should broadcast user online status when connecting', (done) => {
      clientSocket1.on('user-online', (data) => {
        expect(data.userId).toBe(testUser2.id);
        expect(data.userName).toBe('Test User 2');
        expect(data.timestamp).toBeDefined();
        done();
      });

      // User 2 is already connected, so we disconnect and reconnect to trigger the event
      clientSocket2.disconnect();
      setTimeout(() => {
        clientSocket2 = new Client(`http://localhost:${process.env.PORT || 5000}`, {
          auth: { token: token2 }
        });
      }, 100);
    });

    it('should send current online users to new connection', (done) => {
      clientSocket1.on('online-users', (users) => {
        expect(Array.isArray(users)).toBe(true);
        const user2Online = users.find(u => u.userId === testUser2.id);
        expect(user2Online).toBeDefined();
        expect(user2Online.userName).toBe('Test User 2');
        done();
      });

      // Trigger by reconnecting
      clientSocket1.disconnect();
      setTimeout(() => {
        clientSocket1 = new Client(`http://localhost:${process.env.PORT || 5000}`, {
          auth: { token: token1 }
        });
      }, 100);
    });
  });

  describe('Room Management', () => {
    it('should join conversation room successfully', (done) => {
      clientSocket1.emit('join-room', { contactId: testUser2.id });
      
      clientSocket1.on('room-joined', (data) => {
        expect(data.roomName).toBe(`conversation_${Math.min(testUser1.id, testUser2.id)}_${Math.max(testUser1.id, testUser2.id)}`);
        expect(data.contactId).toBe(testUser2.id);
        done();
      });
    });

    it('should handle invalid contact ID when joining room', (done) => {
      clientSocket1.emit('join-room', { contactId: 'invalid' });
      
      clientSocket1.on('error', (error) => {
        expect(error.message).toBe('Invalid contact ID');
        done();
      });
    });
  });

  describe('Real-time Messaging', () => {
    beforeEach((done) => {
      // Join both users to the same conversation room
      let joinedCount = 0;
      const checkJoined = () => {
        joinedCount++;
        if (joinedCount === 2) {
          done();
        }
      };

      clientSocket1.emit('join-room', { contactId: testUser2.id });
      clientSocket2.emit('join-room', { contactId: testUser1.id });

      clientSocket1.on('room-joined', checkJoined);
      clientSocket2.on('room-joined', checkJoined);
    });

    it('should send and receive messages in real-time', (done) => {
      const messageContent = 'Hello from integration test!';

      clientSocket2.on('message-received', (message) => {
        expect(message.content).toBe(messageContent);
        expect(message.senderId).toBe(testUser1.id);
        expect(message.senderName).toBe('Test User 1');
        expect(message.recipientId).toBe(testUser2.id);
        expect(message.timestamp).toBeDefined();
        done();
      });

      clientSocket1.emit('send-message', {
        recipientId: testUser2.id,
        content: messageContent,
        messageType: 'text'
      });
    });

    it('should validate message content', (done) => {
      clientSocket1.emit('send-message', {
        recipientId: testUser2.id,
        content: '',
        messageType: 'text'
      });

      clientSocket1.on('error', (error) => {
        expect(error.message).toBe('Message content cannot be empty');
        done();
      });
    });

    it('should reject messages to non-existent users', (done) => {
      clientSocket1.emit('send-message', {
        recipientId: 99999,
        content: 'Hello',
        messageType: 'text'
      });

      clientSocket1.on('error', (error) => {
        expect(error.message).toBe('Recipient not found');
        done();
      });
    });
  });

  describe('Typing Indicators', () => {
    beforeEach((done) => {
      // Join both users to the same conversation room
      let joinedCount = 0;
      const checkJoined = () => {
        joinedCount++;
        if (joinedCount === 2) {
          done();
        }
      };

      clientSocket1.emit('join-room', { contactId: testUser2.id });
      clientSocket2.emit('join-room', { contactId: testUser1.id });

      clientSocket1.on('room-joined', checkJoined);
      clientSocket2.on('room-joined', checkJoined);
    });

    it('should broadcast typing indicators', (done) => {
      clientSocket2.on('user-typing', (data) => {
        expect(data.userId).toBe(testUser1.id);
        expect(data.userName).toBe('Test User 1');
        expect(data.contactId).toBe(testUser2.id);
        expect(data.isTyping).toBe(true);
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket1.emit('typing', {
        contactId: testUser2.id,
        isTyping: true
      });
    });

    it('should broadcast stop typing indicators', (done) => {
      clientSocket2.on('user-typing', (data) => {
        expect(data.isTyping).toBe(false);
        done();
      });

      clientSocket1.emit('stop-typing', {
        contactId: testUser2.id
      });
    });
  });

  describe('Message Read Status', () => {
    let messageId;

    beforeEach(async () => {
      // Create a test message
      const messageResult = await pool.query(
        'INSERT INTO messages (sender_id, recipient_id, content, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
        [testUser1.id, testUser2.id, 'Test message for read status']
      );
      messageId = messageResult.rows[0].id;
    });

    it('should mark message as read and notify sender', (done) => {
      clientSocket1.on('message-read', (data) => {
        expect(data.messageId).toBe(messageId);
        expect(data.readBy).toBe(testUser2.id);
        expect(data.readAt).toBeDefined();
        done();
      });

      clientSocket2.emit('mark-as-read', {
        messageId: messageId,
        senderId: testUser1.id
      });
    });
  });

  describe('Disconnection Handling', () => {
    it('should broadcast user offline status when disconnecting', (done) => {
      clientSocket1.on('user-offline', (data) => {
        expect(data.userId).toBe(testUser2.id);
        expect(data.userName).toBe('Test User 2');
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket2.disconnect();
    });
  });
});