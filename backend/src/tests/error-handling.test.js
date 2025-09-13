const request = require('supertest');
const { app } = require('../../server');
const {
  errorHandler,
  notFoundHandler,
  createValidationError,
  createNotFoundError,
  createConflictError,
  createUnauthorizedError,
  createForbiddenError,
} = require('../middleware/errorHandler');

describe('Error Handling Middleware', () => {
  describe('Error Helper Functions', () => {
    test('createValidationError should create validation error', () => {
      const error = createValidationError('Invalid input', { field: 'email' });
      
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
    });

    test('createNotFoundError should create not found error', () => {
      const error = createNotFoundError('User');
      
      expect(error.message).toBe('User not found');
      expect(error.name).toBe('NotFoundError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    test('createConflictError should create conflict error', () => {
      const error = createConflictError('Resource exists', { id: 123 });
      
      expect(error.message).toBe('Resource exists');
      expect(error.name).toBe('ConflictError');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.details).toEqual({ id: 123 });
    });

    test('createUnauthorizedError should create unauthorized error', () => {
      const error = createUnauthorizedError('Token invalid');
      
      expect(error.message).toBe('Token invalid');
      expect(error.name).toBe('UnauthorizedError');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    test('createForbiddenError should create forbidden error', () => {
      const error = createForbiddenError('Access denied');
      
      expect(error.message).toBe('Access denied');
      expect(error.name).toBe('ForbiddenError');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Error Handler Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        originalUrl: '/test',
        headers: {},
        body: {},
        params: {},
        query: {},
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('test-agent'),
      };

      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        statusCode: 500,
      };

      mockNext = jest.fn();

      // Mock console methods
      jest.spyOn(console, 'error').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'info').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should handle validation errors', () => {
      const error = createValidationError('Invalid email');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email',
        }
      });
    });

    test('should handle unauthorized errors', () => {
      const error = new Error('jwt malformed');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        }
      });
    });

    test('should handle PostgreSQL unique violation', () => {
      const error = new Error('Duplicate key');
      error.code = '23505';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Resource already exists',
        }
      });
    });

    test('should handle PostgreSQL foreign key violation', () => {
      const error = new Error('Foreign key constraint');
      error.code = '23503';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced resource does not exist',
        }
      });
    });

    test('should handle database connection errors', () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connection failed',
        }
      });
    });

    test('should handle generic errors', () => {
      const error = new Error('Something went wrong');
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        }
      });
    });

    test('should include details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = createValidationError('Invalid input', { field: 'email' });
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { field: 'email' },
            stack: expect.any(String),
            request: expect.any(Object),
          })
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    test('should log errors appropriately', () => {
      const error = new Error('Test error');
      mockRes.statusCode = 500;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(console.error).toHaveBeenCalledWith(
        'Server Error:',
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          statusCode: 500,
          error: expect.objectContaining({
            message: 'Test error'
          })
        })
      );
    });

    test('should log client errors as warnings', () => {
      const error = createValidationError('Invalid input');
      mockRes.statusCode = 400;
      
      errorHandler(error, mockReq, mockRes, mockNext);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Client Error:',
        expect.any(Object)
      );
    });
  });

  describe('Not Found Handler', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
      mockReq = {
        method: 'GET',
        originalUrl: '/nonexistent',
      };

      mockRes = {};
      mockNext = jest.fn();
    });

    test('should create 404 error for unmatched routes', () => {
      notFoundHandler(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route GET /nonexistent not found',
          statusCode: 404,
          code: 'ROUTE_NOT_FOUND',
        })
      );
    });
  });
});

describe('API Error Responses', () => {
  test('should return structured error for invalid route', async () => {
    const response = await request(app)
      .get('/api/nonexistent')
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Route GET /api/nonexistent not found',
      }
    });
  });

  test('should return health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: 'healthy',
        timestamp: expect.any(String),
      }
    });
  });

  test('should return server info', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        message: 'Real-time Messaging API Server',
        version: '1.0.0',
        status: 'healthy',
      }
    });
  });
});