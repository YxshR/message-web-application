const request = require('supertest');
const { app } = require('../../server');
const { pool } = require('../config/database');
const { generateAccessToken } = require('../utils/jwt');

describe('Messages API Integration Tests', () => {
  let testUsers = [];
  let authTokens = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM messages WHERE 1=1');
    await pool.query('DELETE FROM contacts WHERE 1=1');
    await pool.query('DELETE FROM users WHERE email LIKE \'%test-messages%\'');

    // Create test users
    const userQueries = [
      {
        name: 'Alice Test Messages',
        email: 'alice-test-messages@example.com',
        password: 'password123'
      },
      {
        name: 'Bob Test Messages', 
        email: 'bob-test-messages@example.com',
        password: 'password123'
      },
      {
        name: 'Charlie Test Messages',
        email: 'charlie-test-messages@example.com', 
        password: 'password123'
      }
    ];

    for (const userData of userQueries) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      expect(response.status).toBe(201);
      testUsers.push(response.body.data.user);
      authTokens.push(response.body.data.token);
    }
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM messages WHERE 1=1');
    await pool.query('DELETE FROM contacts WHERE 1=1');
    await pool.query('DELETE FROM users WHERE email LIKE \'%test-messages%\'');
  });

  describe('POST /api/messages', () => {
    test('should send a message successfully', async () => {
      const messageData = {
        recipientId: testUsers[1].id,
        content: 'Hello Bob, this is a test message!',
        type: 'text'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toMatchObject({
        senderId: testUsers[0].id,
        recipientId: testUsers[1].id,
        content: messageData.content,
        type: 'text',
        isSent: true
      });
      expect(response.body.data.message.id).toBeDefined();
      expect(response.body.data.message.timestamp).toBeDefined();
      expect(response.body.data.recipient).toMatchObject({
        id: testUsers[1].id,
        name: testUsers[1].name,
        email: testUsers[1].email
      });
    });

    test('should fail without authentication', async () => {
      const messageData = {
        recipientId: testUsers[1].id,
        content: 'This should fail'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should fail with empty content', async () => {
      const messageData = {
        recipientId: testUsers[1].id,
        content: '   '
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPTY_CONTENT');
    });

    test('should fail with content too long', async () => {
      const messageData = {
        recipientId: testUsers[1].id,
        content: 'a'.repeat(5001)
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
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
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RECIPIENT_ID');
    });

    test('should fail when sending to non-existent user', async () => {
      const messageData = {
        recipientId: 99999,
        content: 'Test message'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    });

    test('should fail when sending to self', async () => {
      const messageData = {
        recipientId: testUsers[0].id,
        content: 'Message to myself'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SELF_MESSAGE_NOT_ALLOWED');
    });

    test('should fail with invalid message type', async () => {
      const messageData = {
        recipientId: testUsers[1].id,
        content: 'Test message',
        type: 'invalid_type'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send(messageData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE_TYPE');
    });
  });

  describe('GET /api/messages/:contactId', () => {
    beforeAll(async () => {
      // Create some test messages for pagination testing
      const messages = [
        { sender: 0, recipient: 1, content: 'Message 1' },
        { sender: 1, recipient: 0, content: 'Message 2' },
        { sender: 0, recipient: 1, content: 'Message 3' },
        { sender: 1, recipient: 0, content: 'Message 4' },
        { sender: 0, recipient: 1, content: 'Message 5' }
      ];

      for (const msg of messages) {
        await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${authTokens[msg.sender]}`)
          .send({
            recipientId: testUsers[msg.recipient].id,
            content: msg.content
          });
      }
    });

    test('should retrieve message history successfully', async () => {
      const response = await request(app)
        .get(`/api/messages/${testUsers[1].id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toBeInstanceOf(Array);
      expect(response.body.data.messages.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toMatchObject({
        currentPage: 1,
        totalPages: expect.any(Number),
        totalMessages: expect.any(Number),
        hasMore: expect.any(Boolean),
        limit: 50
      });
      expect(response.body.data.contact).toMatchObject({
        id: testUsers[1].id,
        name: testUsers[1].name,
        email: testUsers[1].email
      });

      // Check message format
      const message = response.body.data.messages[0];
      expect(message).toMatchObject({
        id: expect.any(Number),
        senderId: expect.any(Number),
        recipientId: expect.any(Number),
        content: expect.any(String),
        timestamp: expect.any(String),
        type: expect.any(String),
        senderName: expect.any(String),
        recipientName: expect.any(String),
        isSent: expect.any(Boolean)
      });
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/messages/${testUsers[1].id}?page=1&limit=2`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/messages/${testUsers[1].id}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should fail with invalid contact ID', async () => {
      const response = await request(app)
        .get('/api/messages/invalid')
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CONTACT_ID');
    });

    test('should fail with non-existent contact', async () => {
      const response = await request(app)
        .get('/api/messages/99999')
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });

    test('should return empty array for no messages', async () => {
      const response = await request(app)
        .get(`/api/messages/${testUsers[2].id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.pagination.totalMessages).toBe(0);
    });
  });

  describe('PUT /api/messages/:messageId/read', () => {
    let testMessageId;

    beforeAll(async () => {
      // Create a test message
      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({
          recipientId: testUsers[1].id,
          content: 'Message to mark as read'
        });
      
      testMessageId = response.body.data.message.id;
    });

    test('should mark message as read successfully', async () => {
      const response = await request(app)
        .put(`/api/messages/${testMessageId}/read`)
        .set('Authorization', `Bearer ${authTokens[1]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBe(testMessageId);
      expect(response.body.data.readAt).toBeDefined();
      expect(response.body.data.alreadyRead).toBe(false);
    });

    test('should return already read status for read message', async () => {
      const response = await request(app)
        .put(`/api/messages/${testMessageId}/read`)
        .set('Authorization', `Bearer ${authTokens[1]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alreadyRead).toBe(true);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .put(`/api/messages/${testMessageId}/read`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should fail with invalid message ID', async () => {
      const response = await request(app)
        .put('/api/messages/invalid/read')
        .set('Authorization', `Bearer ${authTokens[1]}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE_ID');
    });

    test('should fail when not the recipient', async () => {
      const response = await request(app)
        .put(`/api/messages/${testMessageId}/read`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MESSAGE_NOT_FOUND');
    });
  });

  describe('GET /api/messages/unread/count', () => {
    beforeAll(async () => {
      // Send some unread messages to user 1
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({
          recipientId: testUsers[1].id,
          content: 'Unread message 1'
        });

      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[2]}`)
        .send({
          recipientId: testUsers[1].id,
          content: 'Unread message 2'
        });
    });

    test('should get unread message count successfully', async () => {
      const response = await request(app)
        .get('/api/messages/unread/count')
        .set('Authorization', `Bearer ${authTokens[1]}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBeGreaterThanOrEqual(2);
    });

    test('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/messages/unread/count');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Message Status Tracking', () => {
    test('should track message delivery status', async () => {
      // Send a message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({
          recipientId: testUsers[1].id,
          content: 'Status tracking test message'
        });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.data.message.id;

      // Retrieve messages to check initial status
      const getResponse = await request(app)
        .get(`/api/messages/${testUsers[0].id}`)
        .set('Authorization', `Bearer ${authTokens[1]}`);

      const message = getResponse.body.data.messages.find(m => m.id === messageId);
      expect(message.readAt).toBeNull();

      // Mark as read
      const readResponse = await request(app)
        .put(`/api/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${authTokens[1]}`);

      expect(readResponse.status).toBe(200);

      // Verify read status
      const getResponse2 = await request(app)
        .get(`/api/messages/${testUsers[0].id}`)
        .set('Authorization', `Bearer ${authTokens[1]}`);

      const readMessage = getResponse2.body.data.messages.find(m => m.id === messageId);
      expect(readMessage.readAt).not.toBeNull();
    });
  });

  describe('Message History Sorting and Filtering', () => {
    test('should return messages in chronological order (newest first)', async () => {
      const response = await request(app)
        .get(`/api/messages/${testUsers[1].id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      expect(response.status).toBe(200);
      const messages = response.body.data.messages;
      
      if (messages.length > 1) {
        for (let i = 0; i < messages.length - 1; i++) {
          const currentTime = new Date(messages[i].timestamp);
          const nextTime = new Date(messages[i + 1].timestamp);
          expect(currentTime.getTime()).toBeGreaterThanOrEqual(nextTime.getTime());
        }
      }
    });

    test('should properly filter messages between specific users', async () => {
      // Send message from user 0 to user 2
      await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({
          recipientId: testUsers[2].id,
          content: 'Message to Charlie'
        });

      // Get messages between user 0 and user 1
      const response1 = await request(app)
        .get(`/api/messages/${testUsers[1].id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      // Get messages between user 0 and user 2  
      const response2 = await request(app)
        .get(`/api/messages/${testUsers[2].id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      // Messages should be filtered correctly
      expect(response1.body.data.messages.every(msg => 
        (msg.senderId === testUsers[0].id && msg.recipientId === testUsers[1].id) ||
        (msg.senderId === testUsers[1].id && msg.recipientId === testUsers[0].id)
      )).toBe(true);

      expect(response2.body.data.messages.every(msg =>
        (msg.senderId === testUsers[0].id && msg.recipientId === testUsers[2].id) ||
        (msg.senderId === testUsers[2].id && msg.recipientId === testUsers[0].id)
      )).toBe(true);
    });
  });
});