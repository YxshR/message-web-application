const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from handshake auth or query parameters
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    // Extract token from handshake auth or query parameters
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Check if user still exists in database
    const userQuery = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return next(new Error('User not found'));
    }

    // Add user info to socket object
    socket.user = {
      id: userResult.rows[0].id,
      name: userResult.rows[0].name,
      email: userResult.rows[0].email,
      createdAt: userResult.rows[0].created_at
    };

    next();
  } catch (error) {
    let errorMessage = 'Authentication failed';

    if (error.message === 'Token expired') {
      errorMessage = 'Access token has expired';
    } else if (error.message === 'Invalid token') {
      errorMessage = 'Invalid access token';
    }

    next(new Error(errorMessage));
  }
};

module.exports = {
  socketAuthMiddleware
};