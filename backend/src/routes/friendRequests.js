const express = require('express');
const { 
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest
} = require('../services/friendRequestService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/friend-requests/search?q=query
 * Search for users by username or email
 */
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Search query is required'
        }
      });
    }

    const users = await searchUsers(query, userId);
    
    // Prevent caching of search results
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.json({
      success: true,
      message: 'Users found',
      data: {
        users: users
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    
    // Handle database connection errors
    if (error.message.includes('Closed') || error.message.includes('connection')) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Database connection issue. Please try again.'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Failed to search users'
      }
    });
  }
});

/**
 * GET /api/friend-requests
 * Get all friend requests for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const requests = await getFriendRequests(userId);
    
    res.json({
      success: true,
      message: 'Friend requests retrieved successfully',
      data: requests
    });

  } catch (error) {
    console.error('Get friend requests error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'FRIEND_REQUESTS_FETCH_ERROR',
        message: 'Failed to retrieve friend requests'
      }
    });
  }
});

/**
 * POST /api/friend-requests
 * Send a friend request
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId } = req.body;
    
    const friendRequest = await sendFriendRequest(senderId, receiverId);
    
    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: {
        friendRequest: friendRequest
      }
    });

  } catch (error) {
    console.error('Send friend request error:', error);
    
    // Handle validation errors
    if (error.message.includes('required') || error.message.includes('empty')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }
    
    // Handle user not found
    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Handle self-request attempt
    if (error.message === 'Cannot send friend request to yourself') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: error.message
        }
      });
    }
    
    // Handle duplicate or existing relationships
    if (error.message.includes('already') || error.message.includes('contacts')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'RELATIONSHIP_EXISTS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'FRIEND_REQUEST_ERROR',
        message: 'Failed to send friend request'
      }
    });
  }
});

/**
 * PUT /api/friend-requests/:requestId/accept
 * Accept a friend request
 */
router.put('/:requestId/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    const result = await acceptFriendRequest(requestId, userId);
    
    res.json({
      success: true,
      message: result.message,
      data: {
        friendRequest: result.friendRequest,
        contacts: result.contacts
      }
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    
    // Handle not found
    if (error.message === 'Friend request not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Handle permission errors
    if (error.message.includes('only accept')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: error.message
        }
      });
    }
    
    // Handle status errors
    if (error.message.includes('no longer pending')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'ACCEPT_REQUEST_ERROR',
        message: 'Failed to accept friend request'
      }
    });
  }
});

/**
 * PUT /api/friend-requests/:requestId/reject
 * Reject a friend request
 */
router.put('/:requestId/reject', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    const result = await rejectFriendRequest(requestId, userId);
    
    res.json({
      success: true,
      message: result.message,
      data: {}
    });

  } catch (error) {
    console.error('Reject friend request error:', error);
    
    // Handle not found
    if (error.message === 'Friend request not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Handle permission errors
    if (error.message.includes('only reject')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: error.message
        }
      });
    }
    
    // Handle status errors
    if (error.message.includes('no longer pending')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'REJECT_REQUEST_ERROR',
        message: 'Failed to reject friend request'
      }
    });
  }
});

/**
 * DELETE /api/friend-requests/:requestId
 * Cancel a sent friend request
 */
router.delete('/:requestId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;
    
    const result = await cancelFriendRequest(requestId, userId);
    
    res.json({
      success: true,
      message: result.message,
      data: {}
    });

  } catch (error) {
    console.error('Cancel friend request error:', error);
    
    // Handle not found
    if (error.message === 'Friend request not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Handle permission errors
    if (error.message.includes('only cancel')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: error.message
        }
      });
    }
    
    // Handle status errors
    if (error.message.includes('no longer pending')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCEL_REQUEST_ERROR',
        message: 'Failed to cancel friend request'
      }
    });
  }
});

module.exports = router;