const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/messages/:contactId
 * Retrieve message history with pagination support
 * Query params: page (default: 1), limit (default: 50)
 */
router.get('/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 messages per request
    const offset = (page - 1) * limit;

    // Validate contactId is a number
    if (isNaN(contactId) || contactId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTACT_ID',
          message: 'Contact ID must be a valid positive number'
        }
      });
    }

    // Verify the contact exists and user has permission to view messages
    const contactQuery = `
      SELECT u.id, u.name, u.email 
      FROM users u 
      WHERE u.id = $1
    `;
    const contactResult = await pool.query(contactQuery, [contactId]);

    if (contactResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTACT_NOT_FOUND',
          message: 'Contact not found'
        }
      });
    }

    // Get messages between the two users with pagination
    const messagesQuery = `
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.created_at,
        m.read_at,
        m.message_type,
        s.name as sender_name,
        r.name as recipient_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.recipient_id = r.id
      WHERE 
        (m.sender_id = $1 AND m.recipient_id = $2) OR 
        (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const messagesResult = await pool.query(messagesQuery, [userId, contactId, limit, offset]);

    // Get total count for pagination info
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE 
        (m.sender_id = $1 AND m.recipient_id = $2) OR 
        (m.sender_id = $2 AND m.recipient_id = $1)
    `;
    const countResult = await pool.query(countQuery, [userId, contactId]);
    const totalMessages = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalMessages / limit);
    const hasMore = page < totalPages;

    // Format messages for response
    const messages = messagesResult.rows.map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: msg.recipient_id,
      content: msg.content,
      timestamp: msg.created_at,
      readAt: msg.read_at,
      type: msg.message_type,
      senderName: msg.sender_name,
      recipientName: msg.recipient_name,
      isSent: msg.sender_id === userId
    }));

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages,
          hasMore,
          limit
        },
        contact: {
          id: contactResult.rows[0].id,
          name: contactResult.rows[0].name,
          email: contactResult.rows[0].email
        }
      }
    });

  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve messages'
      }
    });
  }
});

/**
 * POST /api/messages
 * Send a new message
 * Body: { recipientId, content, type? }
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { recipientId, content, type = 'text' } = req.body;
    const senderId = req.user.id;

    // Validate required fields
    if (!recipientId || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'recipientId and content are required'
        }
      });
    }

    // Validate recipientId is a number
    if (isNaN(recipientId) || recipientId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECIPIENT_ID',
          message: 'Recipient ID must be a valid positive number'
        }
      });
    }

    // Validate content length
    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_CONTENT',
          message: 'Message content cannot be empty'
        }
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTENT_TOO_LONG',
          message: 'Message content cannot exceed 5000 characters'
        }
      });
    }

    // Validate message type
    const validTypes = ['text', 'image', 'file'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE_TYPE',
          message: 'Message type must be one of: text, image, file'
        }
      });
    }

    // Check if sender is trying to send to themselves
    if (senderId === parseInt(recipientId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_MESSAGE_NOT_ALLOWED',
          message: 'Cannot send message to yourself'
        }
      });
    }

    // Verify recipient exists
    const recipientQuery = 'SELECT id, name, email FROM users WHERE id = $1';
    const recipientResult = await pool.query(recipientQuery, [recipientId]);

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RECIPIENT_NOT_FOUND',
          message: 'Recipient not found'
        }
      });
    }

    // Insert the message
    const insertQuery = `
      INSERT INTO messages (sender_id, recipient_id, content, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, sender_id, recipient_id, content, created_at, read_at, message_type
    `;

    const insertResult = await pool.query(insertQuery, [senderId, recipientId, content.trim(), type]);
    const newMessage = insertResult.rows[0];

    // Get sender info for response
    const senderQuery = 'SELECT name, email FROM users WHERE id = $1';
    const senderResult = await pool.query(senderQuery, [senderId]);

    // Format response
    const messageResponse = {
      id: newMessage.id,
      senderId: newMessage.sender_id,
      recipientId: newMessage.recipient_id,
      content: newMessage.content,
      timestamp: newMessage.created_at,
      readAt: newMessage.read_at,
      type: newMessage.message_type,
      senderName: senderResult.rows[0].name,
      recipientName: recipientResult.rows[0].name,
      isSent: true
    };

    res.status(201).json({
      success: true,
      data: {
        message: messageResponse,
        recipient: {
          id: recipientResult.rows[0].id,
          name: recipientResult.rows[0].name,
          email: recipientResult.rows[0].email
        }
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send message'
      }
    });
  }
});

/**
 * PUT /api/messages/:messageId/read
 * Mark a message as read
 */
router.put('/:messageId/read', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    // Validate messageId is a number
    if (isNaN(messageId) || messageId <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_MESSAGE_ID',
          message: 'Message ID must be a valid positive number'
        }
      });
    }

    // Check if message exists and user is the recipient
    const messageQuery = `
      SELECT id, sender_id, recipient_id, read_at
      FROM messages 
      WHERE id = $1 AND recipient_id = $2
    `;
    const messageResult = await pool.query(messageQuery, [messageId, userId]);

    if (messageResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found or you are not the recipient'
        }
      });
    }

    const message = messageResult.rows[0];

    // If already read, return current status
    if (message.read_at) {
      return res.json({
        success: true,
        data: {
          messageId: message.id,
          readAt: message.read_at,
          alreadyRead: true
        }
      });
    }

    // Mark as read
    const updateQuery = `
      UPDATE messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING read_at
    `;
    const updateResult = await pool.query(updateQuery, [messageId]);

    res.json({
      success: true,
      data: {
        messageId: parseInt(messageId),
        readAt: updateResult.rows[0].read_at,
        alreadyRead: false
      }
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to mark message as read'
      }
    });
  }
});

/**
 * GET /api/messages/unread/count
 * Get count of unread messages for the authenticated user
 */
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const countQuery = `
      SELECT COUNT(*) as unread_count
      FROM messages 
      WHERE recipient_id = $1 AND read_at IS NULL
    `;
    const countResult = await pool.query(countQuery, [userId]);

    res.json({
      success: true,
      data: {
        unreadCount: parseInt(countResult.rows[0].unread_count)
      }
    });

  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get unread message count'
      }
    });
  }
});

module.exports = router;