const { socketAuthMiddleware } = require('../socket/socketAuth');
const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');

// Mock dependencies
jest.mock('../utils/jwt');
jest.mock('../config/database');

describe('Socket Authentication Middleware', () => {
  let mockSocket;
  let mockNext;

  beforeEach(() => {
    mockSocket = {
      handshake: {
        auth: {},
        query: {}
      },
      user: null
    };
    mockNext = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Token Extraction', () => {
    it('should extract token from handshake auth', async () => {
      const mockToken = 'valid-jwt-token';
      const mockDecoded = { userId: 1 };
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date()
      };

      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(verifyToken).toHaveBeenCalledWith(mockToken);
      expect(mockSocket.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.created_at
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should extract token from query parameters', async () => {
      const mockToken = 'valid-jwt-token';
      const mockDecoded = { userId: 1 };
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date()
      };

      mockSocket.handshake.query.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(verifyToken).toHaveBeenCalledWith(mockToken);
      expect(mockSocket.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        createdAt: mockUser.created_at
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should prioritize auth token over query token', async () => {
      const authToken = 'auth-token';
      const queryToken = 'query-token';
      const mockDecoded = { userId: 1 };
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date()
      };

      mockSocket.handshake.auth.token = authToken;
      mockSocket.handshake.query.token = queryToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(verifyToken).toHaveBeenCalledWith(authToken);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Authentication Errors', () => {
    it('should reject connection when no token provided', async () => {
      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication token required'));
      expect(mockSocket.user).toBeNull();
    });

    it('should reject connection when token is expired', async () => {
      const mockToken = 'expired-token';
      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Access token has expired'));
      expect(mockSocket.user).toBeNull();
    });

    it('should reject connection when token is invalid', async () => {
      const mockToken = 'invalid-token';
      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Invalid access token'));
      expect(mockSocket.user).toBeNull();
    });

    it('should reject connection when user not found in database', async () => {
      const mockToken = 'valid-token';
      const mockDecoded = { userId: 999 };

      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('User not found'));
      expect(mockSocket.user).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const mockToken = 'valid-token';
      const mockDecoded = { userId: 1 };

      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockRejectedValue(new Error('Database connection failed'));

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
      expect(mockSocket.user).toBeNull();
    });
  });

  describe('Successful Authentication', () => {
    it('should set user data on socket when authentication succeeds', async () => {
      const mockToken = 'valid-token';
      const mockDecoded = { userId: 1 };
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        created_at: new Date('2023-01-01')
      };

      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(mockSocket.user).toEqual({
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2023-01-01')
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should query database with correct user ID', async () => {
      const mockToken = 'valid-token';
      const mockDecoded = { userId: 123 };
      const mockUser = {
        id: 123,
        name: 'Jane Doe',
        email: 'jane@example.com',
        created_at: new Date()
      };

      mockSocket.handshake.auth.token = mockToken;
      verifyToken.mockReturnValue(mockDecoded);
      pool.query.mockResolvedValue({ rows: [mockUser] });

      await socketAuthMiddleware(mockSocket, mockNext);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, name, email, created_at FROM users WHERE id = $1',
        [123]
      );
    });
  });
});