const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getActiveUsers, isUserOnline } = require('../socket/socketHandlers');

const router = express.Router();

/**
 * Get list of currently online users
 */
router.get('/online-users', authenticateToken, (req, res) => {
  try {
    const activeUsers = getActiveUsers();
    
    res.json({
      success: true,
      data: {
        onlineUsers: activeUsers,
        totalOnline: activeUsers.length
      }
    });
  } catch (error) {
    console.error('Error getting online users:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get online users'
      }
    });
  }
});

/**
 * Check if a specific user is online
 */
router.get('/user-status/:userId', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);
    
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID provided'
        }
      });
    }
    
    const isOnline = isUserOnline(userIdNum);
    
    res.json({
      success: true,
      data: {
        userId: userIdNum,
        isOnline: isOnline
      }
    });
  } catch (error) {
    console.error('Error checking user status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to check user status'
      }
    });
  }
});

module.exports = router;