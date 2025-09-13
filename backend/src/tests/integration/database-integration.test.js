const db = require('../../config/database');
const bcrypt = require('bcrypt');

describe('Database Integration Tests', () => {
  // Test data cleanup utilities
  const cleanupTestData = async () => {
    await db.query('DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE email LIKE \'%test%\')');
    await db.query('DELETE FROM contacts WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%test%\')');
    await db.query('DELETE FROM users WHERE email LIKE \'%test%\'');
  };

  const createTestUser = async (name, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hashedPassword]
    );
    return result.rows[0];
  };

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.end();
  });

  describe('User Management', () => {
    it('should create and retrieve users', async () => {
      const user = await createTestUser('Test User', 'dbtest@example.com', 'password123');
      
      expect(user.id).toBeDefined();
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('dbtest@example.com');
      expect(user.password_hash).toBeDefined();
      expect(user.created_at).toBeDefined();

      // Retrieve user
      const result = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe('dbtest@example.com');
    });

    it('should enforce unique email constraint', async () => {
      await createTestUser('User 1', 'duplicate@test.com', 'password123');
      
      // Try to create another user with same email
      await expect(
        createTestUser('User 2', 'duplicate@test.com', 'password456')
      ).rejects.toThrow();
    });

    it('should update user last_seen timestamp', async () => {
      const user = await createTestUser('Active User', 'active@test.com', 'password123');
      const originalLastSeen = user.last_seen;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update last_seen
      await db.query(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      const result = await db.query('SELECT last_seen FROM users WHERE id = $1', [user.id]);
      expect(new Date(result.rows[0].last_seen)).toBeInstanceOf(Date);
      expect(result.rows[0].last_seen).not.toBe(originalLastSeen);
    });
  });

  describe('Contact Management', () => {
    let user1, user2;

    beforeEach(async () => {
      user1 = await createTestUser('User 1', 'user1@test.com', 'password123');
      user2 = await createTestUser('User 2', 'user2@test.com', 'password123');
    });

    it('should create contact relationships', async () => {
      const result = await db.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) RETURNING *',
        [user1.id, user2.id]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(user1.id);
      expect(result.rows[0].contact_user_id).toBe(user2.id);
    });

    it('should prevent duplicate contact relationships', async () => {
      // Create first relationship
      await db.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [user1.id, user2.id]
      );

      // Try to create duplicate
      await expect(
        db.query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [user1.id, user2.id]
        )
      ).rejects.toThrow();
    });

    it('should retrieve contacts with user information', async () => {
      // Create contact relationship
      await db.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [user1.id, user2.id]
      );

      // Retrieve contacts with JOIN
      const result = await db.query(`
        SELECT c.*, u.name, u.email, u.last_seen
        FROM contacts c
        JOIN users u ON c.contact_user_id = u.id
        WHERE c.user_id = $1
      `, [user1.id]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('User 2');
      expect(result.rows[0].email).toBe('user2@test.com');
    });

    it('should cascade delete contacts when user is deleted', async () => {
      // Create contact relationship
      await db.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [user1.id, user2.id]
      );

      // Delete user1
      await db.query('DELETE FROM users WHERE id = $1', [user1.id]);

      // Check that contact relationship was deleted
      const result = await db.query(
        'SELECT * FROM contacts WHERE user_id = $1',
        [user1.id]
      );
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Message Management', () => {
    let user1, user2;

    beforeEach(async () => {
      user1 = await createTestUser('Sender', 'sender@test.com', 'password123');
      user2 = await createTestUser('Receiver', 'receiver@test.com', 'password123');
    });

    it('should create and retrieve messages', async () => {
      const messageContent = 'Test message content';
      
      const result = await db.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
        [user1.id, user2.id, messageContent]
      );

      const message = result.rows[0];
      expect(message.sender_id).toBe(user1.id);
      expect(message.recipient_id).toBe(user2.id);
      expect(message.content).toBe(messageContent);
      expect(message.created_at).toBeDefined();
      expect(message.message_type).toBe('text');
    });

    it('should retrieve conversation messages in chronological order', async () => {
      // Create multiple messages
      const messages = [
        'First message',
        'Second message', 
        'Third message'
      ];

      for (const content of messages) {
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, user2.id, content]
        );
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Retrieve conversation
      const result = await db.query(`
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND recipient_id = $2) 
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at ASC
      `, [user1.id, user2.id]);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].content).toBe('First message');
      expect(result.rows[1].content).toBe('Second message');
      expect(result.rows[2].content).toBe('Third message');
    });

    it('should handle message pagination efficiently', async () => {
      // Create 25 messages
      for (let i = 1; i <= 25; i++) {
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, user2.id, `Message ${i}`]
        );
      }

      // Test pagination
      const page1 = await db.query(`
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND recipient_id = $2) 
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at DESC
        LIMIT 10 OFFSET 0
      `, [user1.id, user2.id]);

      const page2 = await db.query(`
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND recipient_id = $2) 
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at DESC
        LIMIT 10 OFFSET 10
      `, [user1.id, user2.id]);

      expect(page1.rows).toHaveLength(10);
      expect(page2.rows).toHaveLength(10);
      
      // Verify order (newest first)
      expect(page1.rows[0].content).toBe('Message 25');
      expect(page1.rows[9].content).toBe('Message 16');
      expect(page2.rows[0].content).toBe('Message 15');
    });

    it('should update message read status', async () => {
      const result = await db.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
        [user1.id, user2.id, 'Unread message']
      );

      const messageId = result.rows[0].id;
      expect(result.rows[0].read_at).toBeNull();

      // Mark as read
      await db.query(
        'UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1',
        [messageId]
      );

      const updatedResult = await db.query(
        'SELECT * FROM messages WHERE id = $1',
        [messageId]
      );

      expect(updatedResult.rows[0].read_at).not.toBeNull();
      expect(new Date(updatedResult.rows[0].read_at)).toBeInstanceOf(Date);
    });

    it('should cascade delete messages when user is deleted', async () => {
      // Create messages
      await db.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
        [user1.id, user2.id, 'Message from user1']
      );
      
      await db.query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
        [user2.id, user1.id, 'Message from user2']
      );

      // Delete user1
      await db.query('DELETE FROM users WHERE id = $1', [user1.id]);

      // Check that messages involving user1 were deleted
      const result = await db.query(
        'SELECT * FROM messages WHERE sender_id = $1 OR recipient_id = $1',
        [user1.id]
      );
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Database Performance', () => {
    let users = [];

    beforeEach(async () => {
      // Create test users for performance testing
      for (let i = 1; i <= 10; i++) {
        const user = await createTestUser(`Perf User ${i}`, `perf${i}@test.com`, 'password123');
        users.push(user);
      }
    });

    it('should efficiently query messages with proper indexing', async () => {
      const user1 = users[0];
      const user2 = users[1];

      // Create many messages
      for (let i = 1; i <= 100; i++) {
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, user2.id, `Performance test message ${i}`]
        );
      }

      // Measure query performance
      const startTime = Date.now();
      
      const result = await db.query(`
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND recipient_id = $2) 
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at DESC
        LIMIT 20
      `, [user1.id, user2.id]);

      const queryTime = Date.now() - startTime;

      expect(result.rows).toHaveLength(20);
      expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
    });

    it('should handle concurrent message insertions', async () => {
      const user1 = users[0];
      const user2 = users[1];

      // Create concurrent message insertions
      const promises = [];
      for (let i = 1; i <= 20; i++) {
        promises.push(
          db.query(
            'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
            [user1.id, user2.id, `Concurrent message ${i}`]
          )
        );
      }

      await Promise.all(promises);

      // Verify all messages were inserted
      const result = await db.query(
        'SELECT COUNT(*) FROM messages WHERE sender_id = $1 AND recipient_id = $2',
        [user1.id, user2.id]
      );

      expect(parseInt(result.rows[0].count)).toBe(20);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const user = await createTestUser('Integrity User', 'integrity@test.com', 'password123');

      // Try to create message with non-existent recipient
      await expect(
        db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user.id, 99999, 'Invalid message']
        )
      ).rejects.toThrow();

      // Try to create contact with non-existent user
      await expect(
        db.query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [user.id, 99999]
        )
      ).rejects.toThrow();
    });

    it('should handle transaction rollbacks', async () => {
      const user1 = await createTestUser('Trans User 1', 'trans1@test.com', 'password123');
      const user2 = await createTestUser('Trans User 2', 'trans2@test.com', 'password123');

      try {
        await db.query('BEGIN');
        
        // Insert valid message
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, user2.id, 'Valid message']
        );
        
        // Try to insert invalid message (should fail)
        await db.query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [user1.id, 99999, 'Invalid message']
        );
        
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
      }

      // Verify no messages were inserted due to rollback
      const result = await db.query(
        'SELECT COUNT(*) FROM messages WHERE sender_id = $1',
        [user1.id]
      );
      
      expect(parseInt(result.rows[0].count)).toBe(0);
    });
  });
});