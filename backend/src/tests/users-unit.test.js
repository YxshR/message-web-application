const request = require('supertest');
const { app } = require('../../server');

// Mock the database module
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    };
    next();
  }
}));

// Mock bcrypt for password operations
jest.mock('bcrypt', () => ({
  compare: jest.fn()
}));

const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

describe('User Profile Management APIs - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/profile', () => {
    test('should return user profile', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
        last_seen: new Date()
      };

      pool.query.mockResolvedValueOnce({
        rows: [mockUser]
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: 1,
        name: 'Test User',
        email: 'test@example.com'
      });
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    test('should handle user not found', async () => {
      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('should handle database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FETCH_PROFILE_ERROR');
    });
  });

  describe('PUT /api/users/profile', () => {
    test('should update user name successfully', async () => {
      const updatedUser = {
        id: 1,
        name: 'Updated Name',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
        last_seen: new Date()
      };

      pool.query.mockResolvedValueOnce({
        rows: [updatedUser]
      });

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.name).toBe('Updated Name');
      expect(response.body.data.message).toBe('Profile updated successfully');
    });

    test('should update user email successfully', async () => {
      const updatedUser = {
        id: 1,
        name: 'Test User',
        email: 'updated@example.com',
        created_at: new Date(),
        updated_at: new Date(),
        last_seen: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [] }) // Email check - not taken
        .mockResolvedValueOnce({ rows: [updatedUser] }); // Update successful

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'updated@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('updated@example.com');
    });

    test('should reject email that already exists', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 2 }] // Email already taken by another user
      });

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'existing@example.com' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    test('should reject update with no fields provided', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', 'Bearer mock-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('At least one field');
    });
  });

  describe('PUT /api/users/password', () => {
    test('should update password successfully', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{ password_hash: 'old-hash' }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      bcrypt.compare.mockResolvedValueOnce(true);

      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', 'Bearer mock-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Password updated successfully');
    });

    test('should reject incorrect current password', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ password_hash: 'hash' }]
      });

      bcrypt.compare.mockResolvedValueOnce(false);

      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', 'Bearer mock-token')
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
        .set('Authorization', 'Bearer mock-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('at least 6 characters');
    });

    test('should require both passwords', async () => {
      const response = await request(app)
        .put('/api/users/password')
        .set('Authorization', 'Bearer mock-token')
        .send({ currentPassword: 'oldpassword' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Both current password and new password are required');
    });
  });

  describe('PUT /api/users/last-seen', () => {
    test('should update last seen timestamp', async () => {
      const now = new Date();
      pool.query.mockResolvedValueOnce({
        rows: [{ last_seen: now }]
      });

      const response = await request(app)
        .put('/api/users/last-seen')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lastSeen).toBeDefined();
    });

    test('should handle database errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/users/last-seen')
        .set('Authorization', 'Bearer mock-token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UPDATE_LAST_SEEN_ERROR');
    });
  });
});