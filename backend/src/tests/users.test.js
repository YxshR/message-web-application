const request = require('supertest');
const { app } = require('../../server');
const { pool } = require('../config/database');
const { hashPassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

describe('User Profile Management APIs', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);

    // Create test user
    const hashedPassword = await hashPassword('testpassword123');
    
    const userResult = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      ['Test User', 'testuser@example.com', hashedPassword]
    );
    testUser = userResult.rows[0];
    authToken = generateToken(testUser.id);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
  });

  describe('GET /api/users/profile', () => {
    test('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        name: testUser.name,
        email: testUser.email,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        lastSeen: expect.any(String)
      });
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('PUT /api/users/profile', () => {
    test('should update user name successfully', async () => {
      const newName = 'Updated Test User';
      
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe(newName);
      expect(response.body.data.message).toBe('Profile updated successfully');

      // Verify update in database
      const dbResult = await pool.query('SELECT name FROM users WHERE id = $1', [testUser.id]);
      expect(dbResult.rows[0].name).toBe(newName);
    });

    test('should update user email successfully', async () => {
      const newEmail = 'updated@example.com';
      
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: newEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(newEmail);

      // Verify update in database
      const dbResult = await pool.query('SELECT email FROM users WHERE id = $1', [testUser.id]);
      expect(dbResult.rows[0].email).toBe(newEmail);
    });

    test('should update both name and email successfully', async () => {
      const newName = 'Final Test User';
      const newEmail = 'final@example.com';
      
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName, email: newEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe(newName);
      expect(response.body.data.user.email).toBe(newEmail);
    });

    test('should reject update with no fields provided', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('At least one field');
    });

    test('should reject email that already exists', async () => {
      // Create another user
      const hashedPassword = await hashPassword('testpassword123');
      await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
        ['Another User', 'existing@example.com', hashedPassword]
      );

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'existing@example.com' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({ name: 'New Name' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/users/password', () => {
    test('should update password successfully', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'testpassword123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Password updated successfully');

      // Verify password was updated by checking hash changed
      const dbResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [testUser.id]);
      expect(dbResult.rows[0].password_hash).not.toBe(testUser.password_hash);
    });

    test('should reject incorrect current password', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    test('should reject short new password', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'newpassword123',
          newPassword: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least 6 characters');
    });

    test('should require both current and new password', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: 'newpassword123' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Both current password and new password are required');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .send({
          currentPassword: 'newpassword123',
          newPassword: 'anothernewpassword123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/users/last-seen', () => {
    test('should update last seen timestamp', async () => {
      const beforeUpdate = new Date();
      
      const response = await request(app)
        .put('/api/users/last-seen')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lastSeen).toBeDefined();

      const lastSeenDate = new Date(response.body.data.lastSeen);
      expect(lastSeenDate.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/users/last-seen')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});