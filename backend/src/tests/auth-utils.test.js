const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyToken, extractTokenFromHeader } = require('../utils/jwt');

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

    test('should handle empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    test('should handle null password', () => {
      const result = validatePassword(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
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

    test('should handle empty password in comparison', async () => {
      const password = 'TestPassword123';
      const hashed = await hashPassword(password);
      
      const isInvalid = await comparePassword('', hashed);
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
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        verifyToken('invalid-token');
      }).toThrow('Invalid token');
    });

    test('should throw error for malformed token', () => {
      expect(() => {
        verifyToken('not.a.valid.jwt.token');
      }).toThrow('Invalid token');
    });

    test('should throw error for empty token', () => {
      expect(() => {
        verifyToken('');
      }).toThrow('Invalid token');
    });
  });

  describe('generateRefreshToken', () => {
    test('should generate refresh token correctly', () => {
      const payload = { userId: 1, email: 'test@example.com' };
      const token = generateRefreshToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });
  });

  describe('extractTokenFromHeader', () => {
    test('should extract token from valid header', () => {
      const token = 'valid-token-string';
      const header = `Bearer ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    test('should return null for invalid header format', () => {
      expect(extractTokenFromHeader('Invalid header')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('Token valid-token')).toBeNull();
    });

    test('should return null for empty or null header', () => {
      expect(extractTokenFromHeader('')).toBeNull();
      expect(extractTokenFromHeader(null)).toBeNull();
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    test('should handle header with extra spaces', () => {
      const token = 'valid-token-string';
      const header = `Bearer  ${token}`;
      
      const extracted = extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });
  });
});