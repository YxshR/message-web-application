const express = require('express');
const { registerUser, loginUser } = require('../services/authService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const result = await registerUser({ username, email, password });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        token: result.token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific validation errors
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }
    
    // Handle duplicate user errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Failed to register user'
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Login a user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await loginUser({ username, password });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    
    // Handle validation errors
    if (error.message.includes('Validation failed')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }
    
    // Handle invalid credentials
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password'
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: 'Failed to login user'
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information (protected route)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_FETCH_ERROR',
        message: 'Failed to fetch user information'
      }
    });
  }
});

module.exports = router;