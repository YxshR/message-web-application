const express = require('express');
const { getDashboardStats, getDetailedUserStats } = require('../services/dashboardService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for authenticated user
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getDashboardStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    // Handle specific error types
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (error.message === 'User ID is required') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid user data'
        }
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve dashboard statistics'
      }
    });
  }
});

/**
 * GET /api/dashboard/detailed
 * Get detailed statistics for authenticated user (optional endpoint for future use)
 */
router.get('/detailed', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getDetailedUserStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Detailed dashboard stats error:', error);
    
    // Handle specific error types
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (error.message === 'User ID is required') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid user data'
        }
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve detailed dashboard statistics'
      }
    });
  }
});

module.exports = router;