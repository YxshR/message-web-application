const {
  handleConnection,
  handleJoinRoom,
  handleSendMessage,
  handleTyping,
  handleMarkAsRead,
  handleDisconnection,
  activeUsers,
  userRooms
} = require('../socket/socketHandlers');
const { pool } = require('../config/database');

// Mock dependencies
jest.mock('../config/database');

describe('Socket Handlers', () => {
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    // Clear active users and rooms
    activeUsers.clear();
    userRooms.clear();

    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    mockSocket = {
      id: 'socket123',
      user: {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      },
      join: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      broadcast: {
        emit: jest.fn()
      }
    };

    // Reset mocks
    jest.clearAllMocks();
    pool.query.mockClear();
  });

  describe('handleConnection', () => {
    it('should store user in activeUsers map', () => {
      handleConnection(mockIo, mockSocket);

      expect(activeUsers.has(1)).toBe(true);
      const userData = activeUsers.get(1);
      expect(userData.socketId).toBe('socket123');
      expect(userData.userName).toBe('John Doe');
      expect(userData.isTyping).toBe(false);
    });

    it('should join user to personal room', () => {
      handleConnection(mockIo, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user_1');
      expect(userRooms.has(1)).toBe(true);
      expect(userRooms.get(1).has('user_1')).toBe(true);
    });

    it('should broadcast user online status', () => {
      handleConnection(mockIo, mockSocket);

      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user-online', {
        userId: 1,
        userName: 'John Doe',
        timestamp: expect.any(String)
      });
    });

    it('should send current online users to new connection', () => {
      // Add existing user
      activeUsers.set(2, {
        socketId: 'socket456',
        userName: 'Jane Doe',
        lastSeen: new Date(),
        isTyping: false
      });

      handleConnection(mockIo, mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('online-users', 
        expect.arrayContaining([
          expect.objectContaining({
            userId: 2,
            userName: 'Jane Doe'
          })
        ])
      );
    });
  });

  describe('handleJoinRoom', () => {
    beforeEach(() => {
      handleConnection(mockIo, mockSocket);
      jest.clearAllMocks();
    });

    it('should join conversation room with correct naming', () => {
      const data = { contactId: 2 };
      
      handleJoinRoom(mockIo, mockSocket, data);

      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1_2');
      expect(mockSocket.emit).toHaveBeenCalledWith('room-joined', {
        roomName: 'conversation_1_2',
        contactId: 2
      });
    });

    it('should create consistent room names regardless of user order', () => {
      const data1 = { contactId: 5 };
      const data2 = { contactId: 3 };
      
      handleJoinRoom(mockIo, mockSocket, data1);
      handleJoinRoom(mockIo, mockSocket, data2);

      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1_5');
      expect(mockSocket.join).toHaveBeenCalledWith('conversation_1_3');
    });

    it('should handle invalid contact ID', () => {
      const data = { contactId: 'invalid' };
      
      handleJoinRoom(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid contact ID'
      });
    });

    it('should track room membership', () => {
      const data = { contactId: 2 };
      
      handleJoinRoom(mockIo, mockSocket, data);

      expect(userRooms.get(1).has('conversation_1_2')).toBe(true);
    });
  });

  describe('handleSendMessage', () => {
    beforeEach(() => {
      handleConnection(mockIo, mockSocket);
      jest.clearAllMocks();
    });

    it('should save message to database and broadcast', async () => {
      const data = {
        recipientId: 2,
        content: 'Hello there!',
        messageType: 'text'
      };

      const mockRecipient = { id: 2, name: 'Jane Doe' };
      const mockMessage = {
        id: 1,
        sender_id: 1,
        recipient_id: 2,
        content: 'Hello there!',
        message_type: 'text',
        created_at: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockRecipient] }) // recipient check
        .mockResolvedValueOnce({ rows: [mockMessage] }); // message insert

      await handleSendMessage(mockIo, mockSocket, data);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, name FROM users WHERE id = $1',
        [2]
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        [1, 2, 'Hello there!', 'text']
      );

      expect(mockIo.to).toHaveBeenCalledWith('conversation_1_2');
      expect(mockIo.emit).toHaveBeenCalledWith('message-received', 
        expect.objectContaining({
          senderId: 1,
          recipientId: 2,
          content: 'Hello there!',
          senderName: 'John Doe'
        })
      );
    });

    it('should validate message content', async () => {
      const data = {
        recipientId: 2,
        content: '   ', // whitespace only
        messageType: 'text'
      };

      await handleSendMessage(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Message content cannot be empty'
      });
    });

    it('should reject messages that are too long', async () => {
      const data = {
        recipientId: 2,
        content: 'a'.repeat(1001),
        messageType: 'text'
      };

      await handleSendMessage(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Message too long (max 1000 characters)'
      });
    });

    it('should handle non-existent recipient', async () => {
      const data = {
        recipientId: 999,
        content: 'Hello',
        messageType: 'text'
      };

      pool.query.mockResolvedValueOnce({ rows: [] });

      await handleSendMessage(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Recipient not found'
      });
    });
  });

  describe('handleTyping', () => {
    beforeEach(() => {
      handleConnection(mockIo, mockSocket);
      jest.clearAllMocks();
    });

    it('should broadcast typing status to conversation room', () => {
      const data = { contactId: 2, isTyping: true };
      
      // Mock the socket.to().emit chain
      const mockEmit = jest.fn();
      mockSocket.to.mockReturnValue({ emit: mockEmit });
      
      handleTyping(mockIo, mockSocket, data);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation_1_2');
      expect(mockEmit).toHaveBeenCalledWith('user-typing', {
        userId: 1,
        userName: 'John Doe',
        contactId: 2,
        isTyping: true,
        timestamp: expect.any(String)
      });
    });

    it('should update user typing status in activeUsers', () => {
      const data = { contactId: 2, isTyping: true };
      
      handleTyping(mockIo, mockSocket, data);

      expect(activeUsers.get(1).isTyping).toBe(true);
    });

    it('should handle invalid contact ID', () => {
      const data = { contactId: 'invalid', isTyping: true };
      
      handleTyping(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid contact ID'
      });
    });
  });

  describe('handleMarkAsRead', () => {
    beforeEach(() => {
      handleConnection(mockIo, mockSocket);
      jest.clearAllMocks();
    });

    it('should update message read status and notify sender', async () => {
      const data = { messageId: 1, senderId: 2 };
      const mockResult = {
        rows: [{
          id: 1,
          read_at: new Date()
        }]
      };

      pool.query.mockResolvedValueOnce(mockResult);

      await handleMarkAsRead(mockIo, mockSocket, data);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE messages'),
        [1, 1, 2]
      );

      expect(mockIo.to).toHaveBeenCalledWith('user_2');
      expect(mockIo.emit).toHaveBeenCalledWith('message-read', {
        messageId: 1,
        readAt: expect.any(String),
        readBy: 1
      });
    });

    it('should handle invalid message data', async () => {
      const data = { messageId: null, senderId: 2 };
      
      await handleMarkAsRead(mockIo, mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid message data'
      });
    });
  });

  describe('handleDisconnection', () => {
    it('should clean up user data and notify others', () => {
      handleConnection(mockIo, mockSocket);
      jest.clearAllMocks();

      handleDisconnection(mockIo, mockSocket);

      expect(activeUsers.has(1)).toBe(false);
      expect(userRooms.has(1)).toBe(false);
      expect(mockSocket.broadcast.emit).toHaveBeenCalledWith('user-offline', {
        userId: 1,
        userName: 'John Doe',
        timestamp: expect.any(String)
      });
    });

    it('should handle disconnection when user is not set', () => {
      mockSocket.user = null;
      
      expect(() => handleDisconnection(mockIo, mockSocket)).not.toThrow();
      expect(mockSocket.broadcast.emit).not.toHaveBeenCalled();
    });
  });
});