const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { pool } = require('../config/database');

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and adds user info to request object
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    
    // Check if user still exists in database
    const userQuery = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User no longer exists'
        }
      });
    }

    // Add user info to request object
    req.user = {
      id: userResult.rows[0].id,
      name: userResult.rows[0].name,
      email: userResult.rows[0].email,
      createdAt: userResult.rows[0].created_at
    };

    next();
  } catch (error) {
    let errorCode = 'AUTH_ERROR';
    let errorMessage = 'Authentication failed';

    if (error.message === 'Token expired') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Access token has expired';
    } else if (error.message === 'Invalid token') {
      errorCode = 'INVALID_TOKEN';
      errorMessage = 'Invalid access token';
    }

    return res.status(401).json({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      }
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info to request if token is present and valid, but doesn't fail if missing
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);
    
    const userQuery = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);
    
    if (userResult.rows.length > 0) {
      req.user = {
        id: userResult.rows[0].id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email,
        createdAt: userResult.rows[0].created_at
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};