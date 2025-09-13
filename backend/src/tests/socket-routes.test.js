const { getActiveUsers, isUserOnline, activeUsers } = require('../socket/socketHandlers');

// Mock the authentication middleware for testing
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@example.com' };
    next();
  }
}));

describe('Socket Handlers Utility Functions', () => {

  beforeEach(() => {
    // Clear active users before each test
    activeUsers.clear();
  });

  describe('getActiveUsers', () => {
    it('should return empty array when no users are online', () => {
      const result = getActiveUsers();
      expect(result).toEqual([]);
    });

    it('should return list of active users', () => {
      // Simulate online users
      activeUsers.set(1, {
        socketId: 'socket1',
        userName: 'User 1',
        lastSeen: new Date('2023-01-01T10:00:00Z'),
        isTyping: false
      });
      activeUsers.set(2, {
        socketId: 'socket2',
        userName: 'User 2',
        lastSeen: new Date('2023-01-01T10:05:00Z'),
        isTyping: true
      });

      const result = getActiveUsers();
      
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 1,
            userName: 'User 1',
            isTyping: false,
            lastSeen: '2023-01-01T10:00:00.000Z'
          }),
          expect.objectContaining({
            userId: 2,
            userName: 'User 2',
            isTyping: true,
            lastSeen: '2023-01-01T10:05:00.000Z'
          })
        ])
      );
    });
  });

  describe('isUserOnline', () => {
    it('should return false for user not online', () => {
      const result = isUserOnline(123);
      expect(result).toBe(false);
    });

    it('should return true for user that is online', () => {
      // Simulate online user
      activeUsers.set(123, {
        socketId: 'socket123',
        userName: 'Online User',
        lastSeen: new Date(),
        isTyping: false
      });

      const result = isUserOnline(123);
      expect(result).toBe(true);
    });

    it('should handle different user IDs correctly', () => {
      // Add multiple users
      activeUsers.set(1, { socketId: 'socket1', userName: 'User 1', lastSeen: new Date(), isTyping: false });
      activeUsers.set(3, { socketId: 'socket3', userName: 'User 3', lastSeen: new Date(), isTyping: false });

      expect(isUserOnline(1)).toBe(true);
      expect(isUserOnline(2)).toBe(false);
      expect(isUserOnline(3)).toBe(true);
      expect(isUserOnline(4)).toBe(false);
    });
  });
});