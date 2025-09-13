const { Client } = require('socket.io-client');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = require('../../server');
const db = require('../../config/database');

describe('Socket.IO Messaging Integration', () => {
  let httpServer;
  let io;
  let clientSocket1;
  let clientSocket2;
  let user1Token;
  let user2Token;
  let user1Id;
  let user2Id;

  beforeAll(async () => {
    // Clean database
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM contacts');
    await db.query('DELETE FROM users');

    // Create test users
    const request = require('supertest');
    
    // User 1
    const user1Response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User One',
        email: 'user1@example.com',
        password: 'password123'
      });
    
    user1Token = user1Response.body.token;
    user1Id = user1Response.body.user.id;

    // User 2
    const user2Response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Two',
        email: 'user2@example.com',
        password: 'password123'
      });
    
    user2Token = user2Response.body.token;
    user2Id = user2Response.body.user.id;

    // Add contact relationship
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ contactUserId: user2Id });

    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ contactUserId: user1Id });
  });

  afterAll(async () => {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
    if (httpServer) httpServer.close();
    await db.end();
  });

  beforeEach(async () => {
    // Start server for each test
    httpServer = app.listen(0);
    const port = httpServer.address().port;

    // Connect both clients
    clientSocket1 = new Client(`http://localhost:${port}`, {
      auth: { token: user1Token }
    });

    clientSocket2 = new Client(`http://localhost:${port}`, {
      auth: { token: user2Token }
    });

    // Wait for connections
    await Promise.all([
      new Promise(resolve => clientSocket1.on('connect', resolve)),
      new Promise(resolve => clientSocket2.on('connect', resolve))
    ]);
  });

  afterEach(() => {
    if (clientSocket1) clientSocket1.disconnect();
    if (clientSocket2) clientSocket2.disconnect();
    if (httpServer) httpServer.close();
  });

  describe('Real-time Message Delivery', () => {
    it('should deliver messages between users in real-time', async () => {
      return new Promise((resolve) => {
        const testMessage = 'Hello from User 1 to User 2!';

        // User 2 listens for messages
        clientSocket2.on('message-received', (data) => {
          expect(data.content).toBe(testMessage);
          expect(data.senderId).toBe(user1Id);
          expect(data.recipientId).toBe(user2Id);
          resolve();
        });

        // User 1 sends message
        clientSocket1.emit('send-message', {
          recipientId: user2Id,
          content: testMessage
        });
      });
    });

    it('should handle bidirectional messaging', async () => {
      const messages = [];
      let receivedCount = 0;

      return new Promise((resolve) => {
        // Both users listen for messages
        clientSocket1.on('message-received', (data) => {
          messages.push({ receiver: 'user1', data });
          receivedCount++;
          if (receivedCount === 2) checkResults();
        });

        clientSocket2.on('message-received', (data) => {
          messages.push({ receiver: 'user2', data });
          receivedCount++;
          if (receivedCount === 2) checkResults();
        });

        function checkResults() {
          expect(messages).toHaveLength(2);
          
          const user1Message = messages.find(m => m.receiver === 'user2');
          const user2Message = messages.find(m => m.receiver === 'user1');
          
          expect(user1Message.data.content).toBe('Message from User 1');
          expect(user2Message.data.content).toBe('Message from User 2');
          
          resolve();
        }

        // Send messages from both users
        setTimeout(() => {
          clientSocket1.emit('send-message', {
            recipientId: user2Id,
            content: 'Message from User 1'
          });
        }, 100);

        setTimeout(() => {
          clientSocket2.emit('send-message', {
            recipientId: user1Id,
            content: 'Message from User 2'
          });
        }, 200);
      });
    });

    it('should handle rapid message sending', async () => {
      const receivedMessages = [];
      const messageCount = 10;

      return new Promise((resolve) => {
        clientSocket2.on('message-received', (data) => {
          receivedMessages.push(data);
          
          if (receivedMessages.length === messageCount) {
            // Verify all messages received in order
            for (let i = 0; i < messageCount; i++) {
              expect(receivedMessages[i].content).toBe(`Rapid message ${i + 1}`);
            }
            resolve();
          }
        });

        // Send messages rapidly
        for (let i = 1; i <= messageCount; i++) {
          clientSocket1.emit('send-message', {
            recipientId: user2Id,
            content: `Rapid message ${i}`
          });
        }
      });
    });
  });

  describe('Typing Indicators', () => {
    it('should broadcast typing indicators', async () => {
      return new Promise((resolve) => {
        clientSocket2.on('user-typing', (data) => {
          expect(data.userId).toBe(user1Id);
          expect(data.recipientId).toBe(user2Id);
          resolve();
        });

        clientSocket1.emit('typing', {
          recipientId: user2Id
        });
      });
    });

    it('should broadcast stop typing indicators', async () => {
      return new Promise((resolve) => {
        clientSocket2.on('user-stopped-typing', (data) => {
          expect(data.userId).toBe(user1Id);
          expect(data.recipientId).toBe(user2Id);
          resolve();
        });

        clientSocket1.emit('stop-typing', {
          recipientId: user2Id
        });
      });
    });
  });

  describe('Online Status', () => {
    it('should track user online status', async () => {
      return new Promise((resolve) => {
        clientSocket2.on('user-online', (data) => {
          expect(data.userId).toBe(user1Id);
          resolve();
        });

        // Simulate user coming online (reconnection)
        clientSocket1.disconnect();
        setTimeout(() => {
          clientSocket1.connect();
        }, 100);
      });
    });

    it('should track user offline status', async () => {
      return new Promise((resolve) => {
        clientSocket2.on('user-offline', (data) => {
          expect(data.userId).toBe(user1Id);
          resolve();
        });

        clientSocket1.disconnect();
      });
    });
  });

  describe('Connection Management', () => {
    it('should handle connection errors gracefully', async () => {
      // Simulate connection error
      clientSocket1.disconnect();
      
      // Try to send message while disconnected
      clientSocket1.emit('send-message', {
        recipientId: user2Id,
        content: 'This should not be delivered'
      });

      // Wait a bit to ensure no message is received
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reconnect and verify functionality
      clientSocket1.connect();
      
      await new Promise(resolve => {
        clientSocket1.on('connect', resolve);
      });

      expect(clientSocket1.connected).toBe(true);
    });

    it('should handle authentication errors', async () => {
      // Try to connect with invalid token
      const invalidClient = new Client(`http://localhost:${httpServer.address().port}`, {
        auth: { token: 'invalid-token' }
      });

      return new Promise((resolve) => {
        invalidClient.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication failed');
          invalidClient.disconnect();
          resolve();
        });
      });
    });

    it('should clean up resources on disconnect', async () => {
      const initialConnections = io ? io.engine.clientsCount : 0;
      
      clientSocket1.disconnect();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify connection count decreased
      if (io) {
        expect(io.engine.clientsCount).toBeLessThan(initialConnections + 2);
      }
    });
  });

  describe('Message Persistence', () => {
    it('should persist messages to database during real-time delivery', async () => {
      const testMessage = 'Persistent message test';

      return new Promise(async (resolve) => {
        clientSocket2.on('message-received', async (data) => {
          // Verify message was saved to database
          const result = await db.query(
            'SELECT * FROM messages WHERE content = $1',
            [testMessage]
          );
          
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0].sender_id).toBe(user1Id);
          expect(result.rows[0].recipient_id).toBe(user2Id);
          expect(result.rows[0].content).toBe(testMessage);
          
          resolve();
        });

        clientSocket1.emit('send-message', {
          recipientId: user2Id,
          content: testMessage
        });
      });
    });
  });
});