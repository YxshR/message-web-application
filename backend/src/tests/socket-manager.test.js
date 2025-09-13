const { initializeSocket } = require('../socket/socketManager');
const { socketAuthMiddleware } = require('../socket/socketAuth');

// Mock dependencies
jest.mock('../socket/socketAuth');
jest.mock('../socket/socketHandlers', () => ({
  handleConnection: jest.fn(),
  handleJoinRoom: jest.fn(),
  handleSendMessage: jest.fn(),
  handleTyping: jest.fn(),
  handleMarkAsRead: jest.fn(),
  handleDisconnection: jest.fn()
}));

const {
  handleConnection,
  handleJoinRoom,
  handleSendMessage,
  handleTyping,
  handleMarkAsRead,
  handleDisconnection
} = require('../socket/socketHandlers');

describe('Socket Manager', () => {
  let mockIo;
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      id: 'socket123',
      user: { id: 1, name: 'Test User' },
      on: jest.fn(),
      emit: jest.fn()
    };

    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      engine: {
        on: jest.fn()
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('initializeSocket', () => {
    it('should apply authentication middleware', () => {
      initializeSocket(mockIo);

      expect(mockIo.use).toHaveBeenCalledWith(socketAuthMiddleware);
    });

    it('should set up connection handler', () => {
      initializeSocket(mockIo);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should set up engine error handler', () => {
      initializeSocket(mockIo);

      expect(mockIo.engine.on).toHaveBeenCalledWith('connection_error', expect.any(Function));
    });

    it('should register all socket event handlers on connection', () => {
      initializeSocket(mockIo);

      // Get the connection handler
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      
      // Call the connection handler with mock socket
      connectionHandler(mockSocket);

      // Verify handleConnection was called
      expect(handleConnection).toHaveBeenCalledWith(mockIo, mockSocket);

      // Verify all event handlers are registered
      expect(mockSocket.on).toHaveBeenCalledWith('join-room', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('send-message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('typing', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('stop-typing', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('mark-as-read', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should call appropriate handlers when events are emitted', () => {
      initializeSocket(mockIo);

      // Get the connection handler
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      // Get event handlers
      const joinRoomHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join-room')[1];
      const sendMessageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'send-message')[1];
      const typingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'typing')[1];
      const stopTypingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'stop-typing')[1];
      const markAsReadHandler = mockSocket.on.mock.calls.find(call => call[0] === 'mark-as-read')[1];
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];

      // Test each handler
      const testData = { test: 'data' };

      joinRoomHandler(testData);
      expect(handleJoinRoom).toHaveBeenCalledWith(mockIo, mockSocket, testData);

      sendMessageHandler(testData);
      expect(handleSendMessage).toHaveBeenCalledWith(mockIo, mockSocket, testData);

      typingHandler(testData);
      expect(handleTyping).toHaveBeenCalledWith(mockIo, mockSocket, testData);

      stopTypingHandler(testData);
      expect(handleTyping).toHaveBeenCalledWith(mockIo, mockSocket, { ...testData, isTyping: false });

      markAsReadHandler(testData);
      expect(handleMarkAsRead).toHaveBeenCalledWith(mockIo, mockSocket, testData);

      disconnectHandler();
      expect(handleDisconnection).toHaveBeenCalledWith(mockIo, mockSocket);
    });

    it('should handle socket errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      initializeSocket(mockIo);

      // Get the connection handler
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      // Get error handler
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];

      // Test error handling
      const testError = new Error('Test socket error');
      errorHandler(testError);

      expect(consoleSpy).toHaveBeenCalledWith('Socket error for user', 1, ':', testError);
      
      consoleSpy.mockRestore();
    });

    it('should handle connection errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      initializeSocket(mockIo);

      // Get the engine error handler
      const errorHandler = mockIo.engine.on.mock.calls.find(call => call[0] === 'connection_error')[1];

      // Test connection error handling
      const testError = { message: 'Connection failed' };
      errorHandler(testError);

      expect(consoleSpy).toHaveBeenCalledWith('Socket.IO connection error:', 'Connection failed');
      
      consoleSpy.mockRestore();
    });

    it('should log successful initialization', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      initializeSocket(mockIo);

      expect(consoleSpy).toHaveBeenCalledWith('Socket.IO server initialized with authentication');
      
      consoleSpy.mockRestore();
    });
  });
});