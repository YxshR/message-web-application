const request = require('supertest');
const { Client } = require('socket.io-client');
const app = require('../../server');
const db = require('../../config/database');

describe('Concurrent Messaging Performance Tests', () => {
  let server;
  let testUsers = [];
  let authTokens = [];

  beforeAll(async () => {
    // Start server
    server = app.listen(0);
    
    // Clean database
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM contacts');
    await db.query('DELETE FROM users');

    // Create test users for concurrent testing
    for (let i = 1; i <= 10; i++) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`,
          password: 'password123'
        });
      
      testUsers.push(response.body.user);
      authTokens.push(response.body.token);
    }

    // Create contact relationships between users
    for (let i = 0; i < testUsers.length; i++) {
      for (let j = 0; j < testUsers.length; j++) {
        if (i !== j) {
          await request(app)
            .post('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[i]}`)
            .send({ contactUserId: testUsers[j].id });
        }
      }
    }
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    await db.end();
  });

  describe('Concurrent API Requests', () => {
    it('should handle concurrent message sending', async () => {
      const messageCount = 50;
      const promises = [];

      // Create concurrent message sending requests
      for (let i = 0; i < messageCount; i++) {
        const senderIndex = i % testUsers.length;
        const recipientIndex = (i + 1) % testUsers.length;
        
        promises.push(
          request(app)
            .post('/api/messages')
            .set('Authorization', `Bearer ${authTokens[senderIndex]}`)
            .send({
              recipientId: testUsers[recipientIndex].id,
              content: `Concurrent message ${i}`
            })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message.content).toBe(`Concurrent message ${index}`);
      });

      // Performance check - should complete within reasonable time
      const totalTime = endTime - startTime;
      console.log(`Concurrent message sending took ${totalTime}ms for ${messageCount} messages`);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all messages were saved to database
      const dbResult = await db.query('SELECT COUNT(*) FROM messages');
      expect(parseInt(dbResult.rows[0].count)).toBe(messageCount);
    });

    it('should handle concurrent contact retrieval', async () => {
      const requestCount = 20;
      const promises = [];

      // Create concurrent contact retrieval requests
      for (let i = 0; i < requestCount; i++) {
        const userIndex = i % testUsers.length;
        
        promises.push(
          request(app)
            .get('/api/contacts')
            .set('Authorization', `Bearer ${authTokens[userIndex]}`)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.contacts)).toBe(true);
      });

      const totalTime = endTime - startTime;
      console.log(`Concurrent contact retrieval took ${totalTime}ms for ${requestCount} requests`);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent authentication requests', async () => {
      const requestCount = 30;
      const promises = [];

      // Create concurrent login requests
      for (let i = 0; i < requestCount; i++) {
        const userIndex = i % testUsers.length;
        
        promises.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: testUsers[userIndex].email,
              password: 'password123'
            })
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
      });

      const totalTime = endTime - startTime;
      console.log(`Concurrent authentication took ${totalTime}ms for ${requestCount} requests`);
      expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
    });
  });

  describe('Concurrent Socket.IO Connections', () => {
    it('should handle multiple simultaneous Socket.IO connections', async () => {
      const connectionCount = 20;
      const clients = [];
      const port = server.address().port;

      try {
        // Create multiple concurrent connections
        const connectionPromises = [];
        
        for (let i = 0; i < connectionCount; i++) {
          const tokenIndex = i % authTokens.length;
          const client = new Client(`http://localhost:${port}`, {
            auth: { token: authTokens[tokenIndex] }
          });
          
          clients.push(client);
          connectionPromises.push(
            new Promise(resolve => {
              client.on('connect', resolve);
            })
          );
        }

        const startTime = Date.now();
        await Promise.all(connectionPromises);
        const endTime = Date.now();

        // Verify all connections succeeded
        clients.forEach(client => {
          expect(client.connected).toBe(true);
        });

        const totalTime = endTime - startTime;
        console.log(`${connectionCount} concurrent Socket.IO connections took ${totalTime}ms`);
        expect(totalTime).toBeLessThan(5000);

      } finally {
        // Clean up connections
        clients.forEach(client => {
          if (client.connected) {
            client.disconnect();
          }
        });
      }
    });

    it('should handle concurrent message broadcasting via Socket.IO', async () => {
      const messageCount = 30;
      const clients = [];
      const port = server.address().port;
      const receivedMessages = [];

      try {
        // Create two clients for testing
        const client1 = new Client(`http://localhost:${port}`, {
          auth: { token: authTokens[0] }
        });
        
        const client2 = new Client(`http://localhost:${port}`, {
          auth: { token: authTokens[1] }
        });

        clients.push(client1, client2);

        // Wait for connections
        await Promise.all([
          new Promise(resolve => client1.on('connect', resolve)),
          new Promise(resolve => client2.on('connect', resolve))
        ]);

        // Set up message listener
        client2.on('message-received', (data) => {
          receivedMessages.push(data);
        });

        // Send multiple messages concurrently
        const sendPromises = [];
        const startTime = Date.now();

        for (let i = 0; i < messageCount; i++) {
          sendPromises.push(
            new Promise(resolve => {
              client1.emit('send-message', {
                recipientId: testUsers[1].id,
                content: `Concurrent Socket message ${i}`
              });
              setTimeout(resolve, 10); // Small delay between sends
            })
          );
        }

        await Promise.all(sendPromises);

        // Wait for all messages to be received
        await new Promise(resolve => {
          const checkMessages = () => {
            if (receivedMessages.length >= messageCount) {
              resolve();
            } else {
              setTimeout(checkMessages, 100);
            }
          };
          checkMessages();
        });

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`${messageCount} concurrent Socket.IO messages took ${totalTime}ms`);
        expect(receivedMessages.length).toBe(messageCount);
        expect(totalTime).toBeLessThan(10000);

      } finally {
        clients.forEach(client => {
          if (client.connected) {
            client.disconnect();
          }
        });
      }
    });
  });

  describe('Database Performance Under Load', () => {
    it('should maintain performance with large message volumes', async () => {
      const messageCount = 1000;
      const batchSize = 50;
      const batches = [];

      // Create batches of concurrent inserts
      for (let i = 0; i < messageCount; i += batchSize) {
        const batch = [];
        
        for (let j = 0; j < batchSize && (i + j) < messageCount; j++) {
          const senderIndex = (i + j) % testUsers.length;
          const recipientIndex = (i + j + 1) % testUsers.length;
          
          batch.push(
            db.query(
              'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
              [testUsers[senderIndex].id, testUsers[recipientIndex].id, `Bulk message ${i + j}`]
            )
          );
        }
        
        batches.push(batch);
      }

      // Execute batches sequentially to avoid overwhelming the database
      const startTime = Date.now();
      
      for (const batch of batches) {
        await Promise.all(batch);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Inserted ${messageCount} messages in ${totalTime}ms`);
      
      // Verify all messages were inserted
      const countResult = await db.query('SELECT COUNT(*) FROM messages');
      expect(parseInt(countResult.rows[0].count)).toBeGreaterThanOrEqual(messageCount);

      // Performance check - should maintain reasonable performance
      const messagesPerSecond = messageCount / (totalTime / 1000);
      console.log(`Database performance: ${messagesPerSecond.toFixed(2)} messages/second`);
      expect(messagesPerSecond).toBeGreaterThan(50); // Should handle at least 50 messages/second
    });

    it('should handle concurrent read operations efficiently', async () => {
      // First, create some test data
      const user1 = testUsers[0];
      const user2 = testUsers[1];
      
      for (let i = 0; i < 100; i++) {
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, user2.id, `Read test message ${i}`]
        );
      }

      // Now perform concurrent reads
      const readCount = 50;
      const promises = [];

      for (let i = 0; i < readCount; i++) {
        promises.push(
          db.query(`
            SELECT * FROM messages 
            WHERE (sender_id = $1 AND recipient_id = $2) 
               OR (sender_id = $2 AND recipient_id = $1)
            ORDER BY created_at DESC
            LIMIT 20
          `, [user1.id, user2.id])
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Verify all reads succeeded
      results.forEach(result => {
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.length).toBeLessThanOrEqual(20);
      });

      const totalTime = endTime - startTime;
      console.log(`${readCount} concurrent reads took ${totalTime}ms`);
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
    });
  });
});