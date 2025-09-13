const request = require('supertest');
const { app } = require('../../server');
const { pool } = require('../config/database');
const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const { generateAccessToken, verifyToken, extractTokenFromHeader } = require('../utils/jwt');

// Test database setup
beforeAll(async () => {
  // Clean up test data
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
});

afterAll(async () => {
  // Clean up test data
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['%test%']);
  await pool.end();
});

describe('Password Utilities', () => {
  describe('validatePassword', () => {
    test('should validate strong password', () => {
      const result = validatePassword('StrongPass123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should require minimum length', () => {
      const result = validatePassword('Sh0rt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('should require uppercase letter', () => {
      const result = validatePassword('lowercase123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('should require lowercase letter', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('should require number', () => {
      const result = validatePassword('NoNumbers');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('hashPassword and comparePassword', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPassword123';
      const hashed = await hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(50);
    });

    test('should compare passwords correctly', async () => {
      const password = 'TestPassword123';
      const hashed = await hashPassword(password);
      
      const isValid = await comparePassword(password, hashed);
      expect(isValid).toBe(true);
      
      const isInvalid = await comparePassword('WrongPassword', hashed);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('JWT Utilities', () => {
  describe('generateAccessToken and verifyToken', () => {
    test('should generate and verify token correctly', () => {
      const payload = { userId: 1, email: 'test@example.com' };
      const token = generateAccessToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid-token');
      }).toThrow('Invalid token');
    });
  });

  describe('extractTokenFromHeader', () => {
    test('should extract token from valid header', () => {
      const token = 'valid-token-string';
      const header = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    test('should return null for invalid header', () => {
      expect(extractTokenFromHeader('Invalid header')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
      expect(extractTokenFromHeader(null)).toBeNull();
    });
  });
});

describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
    test('should register new user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.name).toBe(userData.name);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.id).toBeDefined();
    });

    test('should reject duplicate email', async () => {
      const userData = {
        name: 'Test User 2',
        email: 'test@example.com', // Same email as above
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

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
        email: 'test2@example.com',
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
    test('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(loginData.email);
    });

    test('should reject invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('should reject non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

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
    let authToken;

    beforeAll(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });
      
      authToken = loginResponse.body.data.token;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });

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
    let authToken;

    beforeAll(async () => {
      // Login to get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });
      
      authToken = loginResponse.body.data.token;
    });

    test('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
    });

    test('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});