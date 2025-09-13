const request = require('supertest');
const { app } = require('../../server');

// Mock the database pool to avoid connection issues in tests
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    end: jest.fn()
  }
}));

describe('Authentication Routes - Basic Tests', () => {
  describe('POST /api/auth/register', () => {
    test('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    test('should reject invalid email format', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    test('should reject weak password', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});