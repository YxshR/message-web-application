const { pool } = require('../config/database');

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> { socketId, lastSeen, isTyping }
const userRooms = new Map(); // userId -> Set of room names

/**
 * Handle user connection and setup
 */
const handleConnection = (io, socket) => {
  const userId = socket.user.id;
  const userName = socket.user.name;
  
  console.log(`User ${userName} (ID: ${userId}) connected with socket ${socket.id}`);
  
  // Store user connection
  activeUsers.set(userId, {
    socketId: socket.id,
    lastSeen: new Date(),
    isTyping: false,
    userName: userName
  });
  
  // Join user to their personal room for receiving messages
  const userRoom = `user_${userId}`;
  socket.join(userRoom);
  
  // Initialize user rooms set if not exists
  if (!userRooms.has(userId)) {
    userRooms.set(userId, new Set());
  }
  userRooms.get(userId).add(userRoom);
  
  // Update user's last seen in database
  updateUserLastSeen(userId);
  
  // Notify other users that this user is online
  socket.broadcast.emit('user-online', {
    userId: userId,
    userName: userName,
    timestamp: new Date().toISOString()
  });
  
  // Send current online users to the newly connected user
  const onlineUsers = Array.from(activeUsers.entries()).map(([id, data]) => ({
    userId: parseInt(id),
    userName: data.userName,
    lastSeen: data.lastSeen.toISOString()
  }));
  
  socket.emit('online-users', onlineUsers);
};

/**
 * Handle joining a conversation room
 */
const handleJoinRoom = (io, socket, data) => {
  try {
    const { contactId } = data;
    const userId = socket.user.id;
    
    if (!contactId || typeof contactId !== 'number') {
      socket.emit('error', { message: 'Invalid contact ID' });
      return;
    }
    
    // Create room name for the conversation (consistent ordering)
    const roomName = createRoomName(userId, contactId);
    
    // Join the conversation room
    socket.join(roomName);
    
    // Track the room for this user
    if (!userRooms.has(userId)) {
      userRooms.set(userId, new Set());
    }
    userRooms.get(userId).add(roomName);
    
    console.log(`User ${userId} joined room ${roomName}`);
    
    socket.emit('room-joined', { roomName, contactId });
  } catch (error) {
    console.error('Error joining room:', error);
    socket.emit('error', { message: 'Failed to join conversation' });
  }
};

/**
 * Handle sending messages
 */
const handleSendMessage = async (io, socket, data) => {
  try {
    const { recipientId, content, messageType = 'text' } = data;
    const senderId = socket.user.id;
    const senderName = socket.user.name;
    
    // Validate input
    if (!recipientId || typeof recipientId !== 'number') {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }
    
    if (!content || content.trim().length === 0) {
      socket.emit('error', { message: 'Message content cannot be empty' });
      return;
    }
    
    if (content.length > 1000) {
      socket.emit('error', { message: 'Message too long (max 1000 characters)' });
      return;
    }
    
    // Check if recipient exists
    const recipientQuery = 'SELECT id, name FROM users WHERE id = $1';
    const recipientResult = await pool.query(recipientQuery, [recipientId]);
    
    if (recipientResult.rows.length === 0) {
      socket.emit('error', { message: 'Recipient not found' });
      return;
    }
    
    // Save message to database
    const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, content, message_type, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, sender_id, recipient_id, content, message_type, created_at
    `;
    
    const messageResult = await pool.query(insertQuery, [
      senderId,
      recipientId,
      content.trim(),
      messageType
    ]);
    
    const savedMessage = messageResult.rows[0];
    
    // Create message object for broadcasting
    const messageData = {
      id: savedMessage.id,
      senderId: savedMessage.sender_id,
      senderName: senderName,
      recipientId: savedMessage.recipient_id,
      content: savedMessage.content,
      messageType: savedMessage.message_type,
      timestamp: savedMessage.created_at.toISOString(),
      readAt: null
    };
    
    // Create room name for the conversation
    const roomName = createRoomName(senderId, recipientId);
    
    // Broadcast message to conversation room (both sender and recipient)
    io.to(roomName).emit('message-received', messageData);
    
    // Also send to recipient's personal room in case they're not in the conversation room
    const recipientRoom = `user_${recipientId}`;
    io.to(recipientRoom).emit('message-received', messageData);
    
    console.log(`Message sent from ${senderId} to ${recipientId} in room ${roomName}`);
    
  } catch (error) {
    console.error('Error sending message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

/**
 * Handle typing indicators
 */
const handleTyping = (io, socket, data) => {
  try {
    const { contactId, isTyping } = data;
    const userId = socket.user.id;
    const userName = socket.user.name;
    
    if (!contactId || typeof contactId !== 'number') {
      socket.emit('error', { message: 'Invalid contact ID' });
      return;
    }
    
    // Update user's typing status
    if (activeUsers.has(userId)) {
      activeUsers.get(userId).isTyping = isTyping;
    }
    
    // Create room name for the conversation
    const roomName = createRoomName(userId, contactId);
    
    // Broadcast typing status to the conversation room (excluding sender)
    socket.to(roomName).emit('user-typing', {
      userId: userId,
      userName: userName,
      contactId: contactId,
      isTyping: isTyping,
      timestamp: new Date().toISOString()
    });
    
    // Also send to contact's personal room
    const contactRoom = `user_${contactId}`;
    socket.to(contactRoom).emit('user-typing', {
      userId: userId,
      userName: userName,
      contactId: contactId,
      isTyping: isTyping,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error handling typing:', error);
    socket.emit('error', { message: 'Failed to update typing status' });
  }
};

/**
 * Handle message read status
 */
const handleMarkAsRead = async (io, socket, data) => {
  try {
    const { messageId, senderId } = data;
    const userId = socket.user.id;
    
    if (!messageId || !senderId) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }
    
    // Update message read status in database
    const updateQuery = `
      UPDATE messages 
      SET read_at = NOW() 
      WHERE id = $1 AND recipient_id = $2 AND sender_id = $3 AND read_at IS NULL
      RETURNING id, read_at
    `;
    
    const result = await pool.query(updateQuery, [messageId, userId, senderId]);
    
    if (result.rows.length > 0) {
      const readMessage = result.rows[0];
      
      // Notify sender that message was read
      const senderRoom = `user_${senderId}`;
      io.to(senderRoom).emit('message-read', {
        messageId: readMessage.id,
        readAt: readMessage.read_at.toISOString(),
        readBy: userId
      });
    }
    
  } catch (error) {
    console.error('Error marking message as read:', error);
    socket.emit('error', { message: 'Failed to mark message as read' });
  }
};

/**
 * Handle user disconnection
 */
const handleDisconnection = (io, socket) => {
  const userId = socket.user?.id;
  const userName = socket.user?.name;
  
  if (userId) {
    console.log(`User ${userName} (ID: ${userId}) disconnected`);
    
    // Update last seen in database
    updateUserLastSeen(userId);
    
    // Remove user from active users
    activeUsers.delete(userId);
    
    // Clean up user rooms
    userRooms.delete(userId);
    
    // Notify other users that this user is offline
    socket.broadcast.emit('user-offline', {
      userId: userId,
      userName: userName,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Create consistent room name for two users
 */
const createRoomName = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort((a, b) => a - b);
  return `conversation_${sortedIds[0]}_${sortedIds[1]}`;
};

/**
 * Update user's last seen timestamp in database
 */
const updateUserLastSeen = async (userId) => {
  try {
    const updateQuery = 'UPDATE users SET last_seen = NOW() WHERE id = $1';
    await pool.query(updateQuery, [userId]);
  } catch (error) {
    console.error('Error updating last seen:', error);
  }
};

/**
 * Get online status for a user
 */
const isUserOnline = (userId) => {
  return activeUsers.has(userId);
};

/**
 * Get all active users
 */
const getActiveUsers = () => {
  return Array.from(activeUsers.entries()).map(([userId, data]) => ({
    userId: parseInt(userId),
    userName: data.userName,
    lastSeen: data.lastSeen.toISOString(),
    isTyping: data.isTyping
  }));
};

module.exports = {
  handleConnection,
  handleJoinRoom,
  handleSendMessage,
  handleTyping,
  handleMarkAsRead,
  handleDisconnection,
  isUserOnline,
  getActiveUsers,
  activeUsers,
  userRooms
};