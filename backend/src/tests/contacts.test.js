const request = require('supertest');
const { app } = require('../../server');
const { pool } = require('../config/database');
const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

describe('Contact Management APIs', () => {
  let testUser1, testUser2, testUser3;
  let authToken1, authToken2;

  beforeAll(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM contacts WHERE 1=1');
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);

    // Create test users
    const hashedPassword = await hashPassword('testpassword123');
    
    // User 1
    const user1Result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User 1', 'testuser1@example.com', hashedPassword]
    );
    testUser1 = user1Result.rows[0];
    authToken1 = generateToken(testUser1.id);

    // User 2
    const user2Result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User 2', 'testuser2@example.com', hashedPassword]
    );
    testUser2 = user2Result.rows[0];
    authToken2 = generateToken(testUser2.id);

    // User 3 (for testing purposes)
    const user3Result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User 3', 'testuser3@example.com', hashedPassword]
    );
    testUser3 = user3Result.rows[0];
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM contacts WHERE 1=1');
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
  });

  describe('GET /api/contacts', () => {
    beforeEach(async () => {
      // Clean contacts before each test
      await pool.query('DELETE FROM contacts WHERE 1=1');
    });

    test('should return empty contacts list for authenticated user', async () => {
      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    test('should return contacts list when user has contacts', async () => {
      // Add a contact relationship
      await pool.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2)',
        [testUser1.id, testUser2.id]
      );

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toHaveLength(1);
      expect(response.body.data.contacts[0]).toMatchObject({
        id: testUser2.id,
        name: testUser2.name,
        email: testUser2.email,
        isOnline: expect.any(Boolean)
      });
      expect(response.body.data.total).toBe(1);
    });

    test('should filter contacts by search query', async () => {
      // Add multiple contacts
      await pool.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2), ($1, $3)',
        [testUser1.id, testUser2.id, testUser3.id]
      );

      const response = await request(app)
        .get('/api/contacts?search=User 2')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toHaveLength(1);
      expect(response.body.data.contacts[0].name).toBe('Test User 2');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/contacts')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/contacts', () => {
    beforeEach(async () => {
      // Clean contacts before each test
      await pool.query('DELETE FROM contacts WHERE 1=1');
    });

    test('should add a new contact successfully', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ email: testUser2.email })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact).toMatchObject({
        id: testUser2.id,
        name: testUser2.name,
        email: testUser2.email,
        isOnline: expect.any(Boolean)
      });
      expect(response.body.data.message).toBe('Contact added successfully');

      // Verify contact was added to database
      const dbResult = await pool.query(
        'SELECT * FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
        [testUser1.id, testUser2.id]
      );
      expect(dbResult.rows).toHaveLength(1);
    });

    test('should reject adding non-existent user', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('should reject adding self as contact', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ email: testUser1.email })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Cannot add yourself as a contact');
    });

    test('should reject duplicate contact', async () => {
      // Add contact first time
      await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ email: testUser2.email })
        .expect(201);

      // Try to add same contact again
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({ email: testUser2.email })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_EXISTS');
    });

    test('should validate required email field', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Email is required');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .send({ email: testUser2.email })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('DELETE /api/contacts/:contactId', () => {
    let contactId;

    beforeEach(async () => {
      // Clean contacts and add a test contact
      await pool.query('DELETE FROM contacts WHERE 1=1');
      
      const result = await pool.query(
        'INSERT INTO contacts (user_id, contact_user_id) VALUES ($1, $2) RETURNING id',
        [testUser1.id, testUser2.id]
      );
      contactId = result.rows[0].id;
    });

    test('should remove contact successfully', async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Contact removed successfully');

      // Verify contact was removed from database
      const dbResult = await pool.query(
        'SELECT * FROM contacts WHERE id = $1',
        [contactId]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    test('should reject removing non-existent contact', async () => {
      const response = await request(app)
        .delete('/api/contacts/99999')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });

    test('should reject removing contact that belongs to another user', async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });

    test('should validate contact ID parameter', async () => {
      const response = await request(app)
        .delete('/api/contacts/invalid-id')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/contacts/${contactId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});