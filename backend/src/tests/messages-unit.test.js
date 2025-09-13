const request = require('supertest');
const express = require('express');
const { authenticateToken } = require('../middleware/auth');

// Mock the database pool
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@example.com' };
    next();
  })
}));

const { pool } = require('../config/database');
const messageRoutes = require('../routes/messages');

describe('Messages Routes Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/messages', messageRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/messages', () => {
    test('should send a message successfully', async () => {
      // Mock database queries
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Recipient', email: 'recipient@example.com' }] }) // recipient check
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            sender_id: 1, 
            recipient_id: 2, 
            content: 'Test message', 
            created_at: new Date(), 
            read_at: null, 
            message_type: 'text' 
          }] 
        }) // insert message
        .mockResolvedValueOnce({ rows: [{ name: 'Test User', email: 'test@example.com' }] }); // sender info

      const messageData = {
        recipientId: 2,
        content: 'Test message',
        type: 'text'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toMatchObject({
        senderId: 1,
        recipientId: 2,
        content: 'Test message',
        type: 'text',
        isSent: true
      });
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    test('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should fail with empty content', async () => {
      const messageData = {
        recipientId: 2,
        content: '   '
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPTY_CONTENT');
    });

    test('should fail with content too long', async () => {
      const messageData = {
        recipientId: 2,
        content: 'a'.repeat(5001)
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTENT_TOO_LONG');
    });

    test('should fail with invalid recipient ID', async () => {
      const messageData = {
        recipientId: 'invalid',
        content: 'Test message'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RECIPIENT_ID');
    });

    test('should fail when sending to non-existent user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // recipient not found

      const messageData = {
        recipientId: 99999,
        content: 'Test message'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    });

    test('should fail when sending to self', async () => {
      const messageData = {
        recipientId: 1, // same as req.user.id
        content: 'Message to myself'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SELF_MESSAGE_NOT_ALLOWED');
    });

    test('should fail with invalid message type', async () => {
      const messageData = {
        recipientId: 2,
        content: 'Test message',
        type: 'invalid_type'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE_TYPE');
    });
  });

  describe('GET /api/messages/:contactId', () => {
    test('should retrieve message history successfully', async () => {
      const mockMessages = [
        {
          id: 1,
          sender_id: 1,
          recipient_id: 2,
          content: 'Hello',
          created_at: new Date(),
          read_at: null,
          message_type: 'text',
          sender_name: 'Test User',
          recipient_name: 'Contact'
        }
      ];

      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Contact', email: 'contact@example.com' }] }) // contact check
        .mockResolvedValueOnce({ rows: mockMessages }) // messages
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }); // count

      const response = await request(app)
        .get('/api/messages/2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toHaveLength(1);
      expect(response.body.data.messages[0]).toMatchObject({
        id: 1,
        senderId: 1,
        recipientId: 2,
        content: 'Hello',
        type: 'text',
        isSent: true
      });
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 1,
        totalMessages: 1,
        hasMore: false,
        limit: 50
      });
    });

    test('should support pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Contact', email: 'contact@example.com' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const response = await request(app)
        .get('/api/messages/2?page=1&limit=2');

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    test('should fail with invalid contact ID', async () => {
      const response = await request(app)
        .get('/api/messages/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CONTACT_ID');
    });

    test('should fail with non-existent contact', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // contact not found

      const response = await request(app)
        .get('/api/messages/99999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });
  });

  describe('PUT /api/messages/:messageId/read', () => {
    test('should mark message as read successfully', async () => {
      pool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            sender_id: 2, 
            recipient_id: 1, 
            read_at: null 
          }] 
        }) // message check
        .mockResolvedValueOnce({ 
          rows: [{ read_at: new Date() }] 
        }); // update

      const response = await request(app)
        .put('/api/messages/1/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBe(1);
      expect(response.body.data.readAt).toBeDefined();
      expect(response.body.data.alreadyRead).toBe(false);
    });

    test('should return already read status for read message', async () => {
      const readAt = new Date();
      pool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 1, 
          sender_id: 2, 
          recipient_id: 1, 
          read_at: readAt 
        }] 
      });

      const response = await request(app)
        .put('/api/messages/1/read');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alreadyRead).toBe(true);
    });

    test('should fail with invalid message ID', async () => {
      const response = await request(app)
        .put('/api/messages/invalid/read');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE_ID');
    });

    test('should fail when not the recipient', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // message not found for user

      const response = await request(app)
        .put('/api/messages/1/read');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MESSAGE_NOT_FOUND');
    });
  });

  describe('GET /api/messages/unread/count', () => {
    test('should get unread message count successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ unread_count: '5' }] });

      const response = await request(app)
        .get('/api/messages/unread/count');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/messages')
        .send({
          recipientId: 2,
          content: 'Test message'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SERVER_ERROR');
    });
  });
});