const { pool, query, transaction, testConnection } = require('../config/database');
const { runMigrations } = require('../migrations/migrate');
const bcrypt = require('bcrypt');

// Test database configuration
const testDbConfig = {
  ...require('../config/database'),
  database: process.env.TEST_DB_NAME || 'messaging_app_test'
};

describe('Database Connection and Operations', () => {
  beforeAll(async () => {
    // Run migrations before tests
    await runMigrations();
  });

  afterAll(async () => {
    // Clean up and close pool
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await query('DELETE FROM messages');
    await query('DELETE FROM contacts');
    await query('DELETE FROM users');
  });

  describe('Database Connection', () => {
    test('should connect to database successfully', async () => {
      const isConnected = await testConnection();
      expect(isConnected).toBe(true);
    });

    test('should execute basic query', async () => {
      const result = await query('SELECT NOW() as current_time');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].current_time).toBeInstanceOf(Date);
    });
  });

  describe('Users Table Operations', () => {
    test('should insert and retrieve user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password_hash: await bcrypt.hash('password123', 12)
      };

      // Insert user
      const insertResult = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
        [userData.name, userData.email, userData.password_hash]
      );

      expect(insertResult.rows).toHaveLength(1);
      const insertedUser = insertResult.rows[0];
      expect(insertedUser.name).toBe(userData.name);
      expect(insertedUser.email).toBe(userData.email);
      expect(insertedUser.id).toBeDefined();
      expect(insertedUser.created_at).toBeInstanceOf(Date);

      // Retrieve user
      const selectResult = await query('SELECT * FROM users WHERE email = $1', [userData.email]);
      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].email).toBe(userData.email);
    });

    test('should enforce unique email constraint', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password_hash: await bcrypt.hash('password123', 12)
      };

      // Insert first user
      await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
        [userData.name, userData.email, userData.password_hash]
      );

      // Try to insert duplicate email
      await expect(
        query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
          ['Another User', userData.email, userData.password_hash]
        )
      ).rejects.toThrow();
    });

    test('should update last_seen timestamp', async () => {
      // Insert user
      const insertResult = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['Test User', 'test@example.com', await bcrypt.hash('password123', 12)]
      );
      const userId = insertResult.rows[0].id;

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update last_seen
      await query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]);

      // Verify update
      const result = await query('SELECT last_seen FROM users WHERE id = $1', [userId]);
      expect(result.rows[0].last_seen).toBeInstanceOf(Date);
    });
  });

  describe('Contacts Table Operations', () => {
    let user1Id, user2Id;

    beforeEach(async () => {
      // Create test users
      const user1Result = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['User 1', 'user1@example.com', await bcrypt.hash('password123', 12)]
      );
      user1Id = user1Result.rows[0].id;

      const user2Result = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['User 2', 'user2@example.com', await bcrypt.hash('password123', 12)]
      );
      user2Id = user2Result.rows[0].id;
    });

    test('should create contact relationship', async () => {
      const result = await query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) RETURNING *',
        [user1Id, user2Id]
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_id).toBe(user1Id);
      expect(result.rows[0].contact_user_id).toBe(user2Id);
      expect(result.rows[0].created_at).toBeInstanceOf(Date);
    });

    test('should enforce unique contact relationship', async () => {
      // Insert first relationship
      await query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [user1Id, user2Id]
      );

      // Try to insert duplicate relationship
      await expect(
        query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [user1Id, user2Id]
        )
      ).rejects.toThrow();
    });

    test('should prevent self-contact relationship', async () => {
      await expect(
        query(
          'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
          [user1Id, user1Id]
        )
      ).rejects.toThrow();
    });

    test('should cascade delete when user is deleted', async () => {
      // Create contact relationship
      await query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [user1Id, user2Id]
      );

      // Delete user
      await query('DELETE FROM users WHERE id = $1', [user1Id]);

      // Verify contact relationship is deleted
      const result = await query('SELECT * FROM contacts WHERE user_id = $1', [user1Id]);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('Messages Table Operations', () => {
    let user1Id, user2Id;

    beforeEach(async () => {
      // Create test users
      const user1Result = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['User 1', 'user1@example.com', await bcrypt.hash('password123', 12)]
      );
      user1Id = user1Result.rows[0].id;

      const user2Result = await query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        ['User 2', 'user2@example.com', await bcrypt.hash('password123', 12)]
      );
      user2Id = user2Result.rows[0].id;
    });

    test('should insert and retrieve message', async () => {
      const messageContent = 'Hello, this is a test message!';
      
      const insertResult = await query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING *',
        [user1Id, user2Id, messageContent]
      );

      expect(insertResult.rows).toHaveLength(1);
      const message = insertResult.rows[0];
      expect(message.sender_id).toBe(user1Id);
      expect(message.recipient_id).toBe(user2Id);
      expect(message.content).toBe(messageContent);
      expect(message.message_type).toBe('text');
      expect(message.created_at).toBeInstanceOf(Date);
      expect(message.read_at).toBeNull();
    });

    test('should retrieve conversation messages in order', async () => {
      // Insert multiple messages
      const messages = [
        { sender: user1Id, recipient: user2Id, content: 'First message' },
        { sender: user2Id, recipient: user1Id, content: 'Second message' },
        { sender: user1Id, recipient: user2Id, content: 'Third message' }
      ];

      for (const msg of messages) {
        await query(
          'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
          [msg.sender, msg.recipient, msg.content]
        );
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Retrieve conversation
      const result = await query(`
        SELECT * FROM messages 
        WHERE (sender_id = $1 AND recipient_id = $2) 
           OR (sender_id = $2 AND recipient_id = $1)
        ORDER BY created_at ASC
      `, [user1Id, user2Id]);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].content).toBe('First message');
      expect(result.rows[1].content).toBe('Second message');
      expect(result.rows[2].content).toBe('Third message');
    });

    test('should mark message as read', async () => {
      // Insert message
      const insertResult = await query(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3) RETURNING id',
        [user1Id, user2Id, 'Test message']
      );
      const messageId = insertResult.rows[0].id;

      // Mark as read
      await query('UPDATE messages SET read_at = NOW() WHERE id = $1', [messageId]);

      // Verify read status
      const result = await query('SELECT read_at FROM messages WHERE id = $1', [messageId]);
      expect(result.rows[0].read_at).toBeInstanceOf(Date);
    });

    test('should enforce valid message types', async () => {
      // Valid message type
      await expect(
        query(
          'INSERT INTO messages (sender_id, recipient_id, content, message_type) VALUES ($1, $2, $3, $4)',
          [user1Id, user2Id, 'Test message', 'text']
        )
      ).resolves.toBeDefined();

      // Invalid message type
      await expect(
        query(
          'INSERT INTO messages (sender_id, recipient_id, content, message_type) VALUES ($1, $2, $3, $4)',
          [user1Id, user2Id, 'Test message', 'invalid_type']
        )
      ).rejects.toThrow();
    });
  });

  describe('Transaction Operations', () => {
    test('should commit successful transaction', async () => {
      const result = await transaction(async (client) => {
        const userResult = await client.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          ['Transaction User', 'transaction@example.com', await bcrypt.hash('password123', 12)]
        );
        return userResult.rows[0].id;
      });

      expect(result).toBeDefined();

      // Verify user was created
      const checkResult = await query('SELECT * FROM users WHERE email = $1', ['transaction@example.com']);
      expect(checkResult.rows).toHaveLength(1);
    });

    test('should rollback failed transaction', async () => {
      await expect(
        transaction(async (client) => {
          await client.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            ['Transaction User', 'transaction2@example.com', await bcrypt.hash('password123', 12)]
          );
          // Force an error
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      // Verify user was not created
      const checkResult = await query('SELECT * FROM users WHERE email = $1', ['transaction2@example.com']);
      expect(checkResult.rows).toHaveLength(0);
    });
  });
});