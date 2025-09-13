const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { generateAccessToken } = require('../utils/jwt');
const { pool } = require('../config/database');

// Mock request and response objects
const mockRequest = (headers = {}, user = null) => ({
  headers,
  user
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

// Test user data
const testUser = {
  id: 1,
  name: 'Test User',
  email: 'test@example.com'
};

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    test('should authenticate valid token and add user to request', async () => {
      // Mock database query
      const mockQuery = jest.spyOn(pool, 'query').mockResolvedValue({
        rows: [{
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
          created_at: new Date()
        }]
      });

      const token = generateAccessToken({ userId: testUser.id, email: testUser.email });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
      expect(req.user.email).toBe(testUser.email);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      mockQuery.mockRestore();
    });

    test('should reject request without authorization header', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token format', async () => {
      const req = mockRequest({ authorization: 'Invalid token format' });
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject request with invalid token', async () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid access token'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should reject request when user not found in database', async () => {
      // Mock database query to return no users
      const mockQuery = jest.spyOn(pool, 'query').mockResolvedValue({
        rows: []
      });

      const token = generateAccessToken({ userId: 999, email: 'nonexistent@example.com' });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User no longer exists'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();

      mockQuery.mockRestore();
    });

    test('should handle database errors gracefully', async () => {
      // Mock database query to throw error
      const mockQuery = jest.spyOn(pool, 'query').mockRejectedValue(new Error('Database error'));

      const token = generateAccessToken({ userId: testUser.id, email: testUser.email });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      await authenticateToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();

      mockQuery.mockRestore();
    });
  });

  describe('optionalAuth', () => {
    test('should add user to request when valid token provided', async () => {
      // Mock database query
      const mockQuery = jest.spyOn(pool, 'query').mockResolvedValue({
        rows: [{
          id: testUser.id,
          name: testUser.name,
          email: testUser.email,
          created_at: new Date()
        }]
      });

      const token = generateAccessToken({ userId: testUser.id, email: testUser.email });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      mockQuery.mockRestore();
    });

    test('should continue without user when no token provided', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeFalsy();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should continue without user when invalid token provided', async () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeFalsy();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should continue without user when database error occurs', async () => {
      // Mock database query to throw error
      const mockQuery = jest.spyOn(pool, 'query').mockRejectedValue(new Error('Database error'));

      const token = generateAccessToken({ userId: testUser.id, email: testUser.email });
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();

      await optionalAuth(req, res, mockNext);

      expect(req.user).toBeFalsy();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      mockQuery.mockRestore();
    });
  });
});