const { Server } = require('socket.io');
const { verifyToken } = require('../utils/auth');
const { getUserById } = require('./authService');
const ChatService = require('./chatService');

class SocketService {
  constructor() {
    this.io = null;
    this.chatService = new ChatService();
    this.connectedUsers = new Map(); // userId -> Set of socketIds
    this.userRooms = new Map(); // socketId -> Set of roomIds
    this.typingUsers = new Map(); // roomId -> Set of userIds
  }

  /**
   * Initialize Socket.IO server
   * @param {object} server - HTTP server instance
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          console.log('Socket connection rejected: No token provided');
          return next(new Error('Authentication token required'));
        }

        const decoded = verifyToken(token);
        const user = await getUserById(decoded.id);
        
        if (!user) {
          console.log('Socket connection rejected: User not found');
          return next(new Error('User not found'));
        }
        
        socket.userId = user.id;
        socket.user = user;
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error.message);
        if (error.name === 'TokenExpiredError') {
          next(new Error('Token expired'));
        } else if (error.name === 'JsonWebTokenError') {
          next(new Error('Invalid token'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('🔌 Socket.IO server initialized');
  }

  /**
   * Handle new socket connection
   * @param {object} socket - Socket instance
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    console.log(`👤 User ${socket.user.username} connected (${socketId})`);

    // Track connected user
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socketId);
    this.userRooms.set(socketId, new Set());

    // Emit connection status to user
    socket.emit('connection_status', { 
      status: 'connected', 
      userId: userId,
      timestamp: new Date().toISOString()
    });

    // Socket event handlers
    socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
    socket.on('leave_room', (data) => this.handleLeaveRoom(socket, data));
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => this.handleDisconnection(socket));
  }

  /**
   * Handle user joining a conversation room
   * @param {object} socket - Socket instance
   * @param {object} data - Room data
   */
  async handleJoinRoom(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Verify user is participant in the conversation
      const conversations = await this.chatService.getUserConversations(userId);
      const conversation = conversations.find(c => c.id === conversationId);

      if (!conversation) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join the room
      socket.join(conversationId);
      this.userRooms.get(socket.id).add(conversationId);

      // Notify other participants
      socket.to(conversationId).emit('user_joined', {
        userId: userId,
        username: socket.user.username,
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      });

      // Confirm join to the user
      socket.emit('room_joined', {
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      });

      console.log(`👤 User ${socket.user.username} joined room ${conversationId}`);

    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle user leaving a conversation room
   * @param {object} socket - Socket instance
   * @param {object} data - Room data
   */
  handleLeaveRoom(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Leave the room
      socket.leave(conversationId);
      this.userRooms.get(socket.id)?.delete(conversationId);

      // Stop typing if user was typing
      this.stopTyping(conversationId, userId);

      // Notify other participants
      socket.to(conversationId).emit('user_left', {
        userId: userId,
        username: socket.user.username,
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      });

      // Confirm leave to the user
      socket.emit('room_left', {
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      });

      console.log(`👤 User ${socket.user.username} left room ${conversationId}`);

    } catch (error) {
      console.error('Leave room error:', error);
      socket.emit('error', { message: 'Failed to leave room' });
    }
  }

  /**
   * Handle sending a message
   * @param {object} socket - Socket instance
   * @param {object} data - Message data
   */
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content } = data;
      const userId = socket.userId;

      if (!conversationId || !content) {
        socket.emit('error', { message: 'Conversation ID and content are required' });
        return;
      }

      if (content.trim().length === 0) {
        socket.emit('error', { message: 'Message content cannot be empty' });
        return;
      }

      if (content.length > 1000) {
        socket.emit('error', { message: 'Message content too long (max 1000 characters)' });
        return;
      }

      // Save message to database
      const message = await this.chatService.sendMessage(conversationId, userId, content.trim());

      // Stop typing indicator for this user
      this.stopTyping(conversationId, userId);

      // Broadcast message to all participants in the room
      this.io.to(conversationId).emit('message_received', {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        sender: message.sender,
        conversationId: message.conversationId,
        createdAt: message.createdAt,
        timestamp: new Date().toISOString()
      });

      console.log(`💬 Message sent in room ${conversationId} by ${socket.user.username}`);

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle typing start indicator
   * @param {object} socket - Socket instance
   * @param {object} data - Typing data
   */
  handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        socket.emit('error', { message: 'Conversation ID is required' });
        return;
      }

      // Add user to typing users for this room
      if (!this.typingUsers.has(conversationId)) {
        this.typingUsers.set(conversationId, new Set());
      }
      this.typingUsers.get(conversationId).add(userId);

      // Notify other participants (exclude sender)
      socket.to(conversationId).emit('typing_indicator', {
        userId: userId,
        username: socket.user.username,
        conversationId: conversationId,
        isTyping: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Typing start error:', error);
    }
  }

  /**
   * Handle typing stop indicator
   * @param {object} socket - Socket instance
   * @param {object} data - Typing data
   */
  handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        return;
      }

      this.stopTyping(conversationId, userId);

    } catch (error) {
      console.error('Typing stop error:', error);
    }
  }

  /**
   * Stop typing indicator for a user in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   */
  stopTyping(conversationId, userId) {
    const typingSet = this.typingUsers.get(conversationId);
    if (typingSet && typingSet.has(userId)) {
      typingSet.delete(userId);
      
      // If no one is typing, clean up the set
      if (typingSet.size === 0) {
        this.typingUsers.delete(conversationId);
      }

      // Notify other participants (only if io is initialized)
      if (this.io) {
        this.io.to(conversationId).emit('typing_indicator', {
          userId: userId,
          conversationId: conversationId,
          isTyping: false,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Handle socket disconnection
   * @param {object} socket - Socket instance
   */
  handleDisconnection(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    console.log(`👤 User ${socket.user?.username || 'Unknown'} disconnected (${socketId})`);

    // Clean up user tracking
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }

    // Clean up typing indicators for all rooms this user was in
    const userRooms = this.userRooms.get(socketId);
    if (userRooms) {
      userRooms.forEach(conversationId => {
        this.stopTyping(conversationId, userId);
        
        // Notify other participants about user leaving
        socket.to(conversationId).emit('user_left', {
          userId: userId,
          username: socket.user?.username || 'Unknown',
          conversationId: conversationId,
          timestamp: new Date().toISOString()
        });
      });
      this.userRooms.delete(socketId);
    }
  }

  /**
   * Get Socket.IO instance
   * @returns {object} Socket.IO server instance
   */
  getIO() {
    return this.io;
  }

  /**
   * Check if user is online
   * @param {string} userId - User ID
   * @returns {boolean} True if user is online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId).size > 0;
  }

  /**
   * Get online users count
   * @returns {number} Number of online users
   */
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get typing users for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Array} Array of user IDs who are typing
   */
  getTypingUsers(conversationId) {
    const typingSet = this.typingUsers.get(conversationId);
    return typingSet ? Array.from(typingSet) : [];
  }
}

module.exports = SocketService;