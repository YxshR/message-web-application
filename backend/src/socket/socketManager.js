const { socketAuthMiddleware } = require('./socketAuth');
const {
  handleConnection,
  handleJoinRoom,
  handleSendMessage,
  handleTyping,
  handleMarkAsRead,
  handleDisconnection
} = require('./socketHandlers');

/**
 * Initialize Socket.IO server with authentication and event handlers
 */
const initializeSocket = (io) => {
  // Apply authentication middleware
  io.use(socketAuthMiddleware);
  
  // Handle connections
  io.on('connection', (socket) => {
    // Handle initial connection
    handleConnection(io, socket);
    
    // Join conversation room
    socket.on('join-room', (data) => {
      handleJoinRoom(io, socket, data);
    });
    
    // Send message
    socket.on('send-message', (data) => {
      handleSendMessage(io, socket, data);
    });
    
    // Typing indicators
    socket.on('typing', (data) => {
      handleTyping(io, socket, data);
    });
    
    socket.on('stop-typing', (data) => {
      handleTyping(io, socket, { ...data, isTyping: false });
    });
    
    // Mark message as read
    socket.on('mark-as-read', (data) => {
      handleMarkAsRead(io, socket, data);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnection(io, socket);
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
      console.error('Socket error for user', socket.user?.id, ':', error);
    });
  });
  
  // Handle authentication errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err.message);
  });
  
  console.log('Socket.IO server initialized with authentication');
};

module.exports = {
  initializeSocket
};