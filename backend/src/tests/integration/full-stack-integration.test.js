const request = require('supertest');
const { Client } = require('socket.io-client');
const app = require('../../server');
const db = require('../../config/database');

describe('Full Stack Integration Tests', () => {
  let server;
  let clientSocket;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Start server
    server = app.listen(0); // Use random port
    const port = server.address().port;
    
    // Clean database
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM contacts');
    await db.query('DELETE FROM users');
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      server.close();
    }
    await db.end();
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM contacts');
    await db.query('DELETE FROM users');
  });

  describe('Authentication Flow Integration', () => {
    it('should register, login, and access protected routes', async () => {
      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.user.email).toBe('test@example.com');
      
      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;

      // Access protected route
      const contactsResponse = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(contactsResponse.body.success).toBe(true);
      expect(Array.isArray(contactsResponse.body.contacts)).toBe(true);
    });

    it('should handle login with existing user', async () => {
      // First register
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'password123'
        });

      // Then login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.user.email).toBe('login@example.com');
      expect(loginResponse.body.token).toBeDefined();
    });
  });

  describe('Contact Management Integration', () => {
    beforeEach(async () => {
      // Register and login user
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Contact User',
          email: 'contact@example.com',
          password: 'password123'
        });
      
      authToken = response.body.token;
      userId = response.body.user.id;
    });

    it('should add and retrieve contacts', async () => {
      // First register the contact user
      const contactUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Contact Person',
          email: 'contactperson@example.com',
          password: 'password123'
        });

      const contactUserId = contactUserResponse.body.user.id;

      // Add contact
      const addResponse = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contactUserId: contactUserId
        })
        .expect(201);

      expect(addResponse.body.success).toBe(true);

      // Retrieve contacts
      const getResponse = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.contacts).toHaveLength(1);
      expect(getResponse.body.contacts[0].name).toBe('Contact Person');
    });
  });

  describe('Messaging Integration', () => {
    let contactUserId;
    let contactAuthToken;

    beforeEach(async () => {
      // Register main user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Main User',
          email: 'main@example.com',
          password: 'password123'
        });
      
      authToken = userResponse.body.token;
      userId = userResponse.body.user.id;

      // Register contact user
      const contactResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Contact User',
          email: 'contactuser@example.com',
          password: 'password123'
        });
      
      contactUserId = contactResponse.body.user.id;
      contactAuthToken = contactResponse.body.token;

      // Add contact relationship
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ contactUserId });
    });

    it('should send and retrieve messages', async () => {
      // Send message
      const sendResponse = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientId: contactUserId,
          content: 'Hello from integration test!'
        })
        .expect(201);

      expect(sendResponse.body.success).toBe(true);
      expect(sendResponse.body.message.content).toBe('Hello from integration test!');

      // Retrieve messages
      const getResponse = await request(app)
        .get(`/api/messages/${contactUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.messages).toHaveLength(1);
      expect(getResponse.body.messages[0].content).toBe('Hello from integration test!');
    });

    it('should handle message pagination', async () => {
      // Send multiple messages
      for (let i = 1; i <= 25; i++) {
        await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            recipientId: contactUserId,
            content: `Message ${i}`
          });
      }

      // Get first page
      const page1Response = await request(app)
        .get(`/api/messages/${contactUserId}?page=1&limit=10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page1Response.body.messages).toHaveLength(10);
      expect(page1Response.body.hasMore).toBe(true);

      // Get second page
      const page2Response = await request(app)
        .get(`/api/messages/${contactUserId}?page=2&limit=10`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(page2Response.body.messages).toHaveLength(10);
      expect(page2Response.body.hasMore).toBe(true);
    });
  });

  describe('Socket.IO Integration', () => {
    beforeEach(async () => {
      // Register user
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Socket User',
          email: 'socket@example.com',
          password: 'password123'
        });
      
      authToken = response.body.token;
      userId = response.body.user.id;

      // Connect socket with auth
      const port = server.address().port;
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: authToken }
      });

      await new Promise((resolve) => {
        clientSocket.on('connect', resolve);
      });
    });

    afterEach(() => {
      if (clientSocket) {
        clientSocket.disconnect();
      }
    });

    it('should connect with valid authentication', async () => {
      expect(clientSocket.connected).toBe(true);
    });

    it('should handle real-time message broadcasting', async () => {
      return new Promise(async (resolve) => {
        // Listen for incoming messages
        clientSocket.on('message-received', (data) => {
          expect(data.content).toBe('Real-time test message');
          expect(data.senderId).toBe(userId);
          resolve();
        });

        // Send message via API (which should trigger Socket.IO broadcast)
        await request(app)
          .post('/api/messages')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            recipientId: userId, // Send to self for testing
            content: 'Real-time test message'
          });
      });
    });

    it('should handle typing indicators', async () => {
      return new Promise((resolve) => {
        clientSocket.on('user-typing', (data) => {
          expect(data.userId).toBe(userId);
          resolve();
        });

        // Emit typing event
        clientSocket.emit('typing', { recipientId: userId });
      });
    });
  });
});