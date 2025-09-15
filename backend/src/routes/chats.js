const express = require('express');
const router = express.Router();
const ChatService = require('../services/chatService');
const chatService = new ChatService();
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/chats
 * Get all conversations for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await chatService.getUserConversations(userId);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Error getting user conversations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONVERSATION_FETCH_ERROR',
        message: 'Failed to retrieve conversations',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/chats/:id/messages
 * Get messages for a specific conversation
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100'
        }
      });
    }

    if (offset < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OFFSET',
          message: 'Offset must be non-negative'
        }
      });
    }

    const messages = await chatService.getConversationMessages(conversationId, userId, limit, offset);
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        limit,
        offset,
        count: messages.length
      }
    });
  } catch (error) {
    console.error('Error getting conversation messages:', error);
    
    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You are not a participant in this conversation'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGE_FETCH_ERROR',
        message: 'Failed to retrieve messages',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/chats/:id/messages
 * Send a message to a conversation
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const senderId = req.user.id;
    const { content } = req.body;

    // Validate message content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE_CONTENT',
          message: 'Message content is required and must be a non-empty string'
        }
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: 'Message content cannot exceed 1000 characters'
        }
      });
    }

    const message = await chatService.sendMessage(conversationId, senderId, content.trim());
    
    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    if (error.message.includes('not a participant')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You are not a participant in this conversation'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'MESSAGE_SEND_ERROR',
        message: 'Failed to send message',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/chats
 * Create a new conversation
 */
router.post('/', async (req, res) => {
  try {
    const { userIds, name } = req.body;
    const currentUserId = req.user.id;

    // Validate userIds
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USER_IDS',
          message: 'userIds must be a non-empty array'
        }
      });
    }

    // Add current user to the conversation if not already included
    const allUserIds = [...new Set([currentUserId, ...userIds])];

    if (allUserIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PARTICIPANTS',
          message: 'At least 2 users are required for a conversation'
        }
      });
    }

    // Validate name for group conversations
    if (name !== null && name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONVERSATION_NAME',
          message: 'Conversation name must be a non-empty string'
        }
      });
    }

    const conversation = await chatService.createConversation(allUserIds, name ? name.trim() : null);
    
    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    
    if (error.message.includes('users not found')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USERS_NOT_FOUND',
          message: 'One or more specified users do not exist'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'CONVERSATION_CREATE_ERROR',
        message: 'Failed to create conversation',
        details: error.message
      }
    });
  }
});

module.exports = router;