const express = require('express');
const { 
  getUserContacts, 
  addContact, 
  removeContact 
} = require('../services/contactService');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const contacts = await getUserContacts(userId);
    
    res.json({
      success: true,
      message: 'Contacts retrieved successfully',
      data: {
        contacts: contacts
      }
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTACTS_FETCH_ERROR',
        message: 'Failed to retrieve contacts'
      }
    });
  }
});

/**
 * POST /api/contacts
 * Add a new contact for the authenticated user
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactIdentifier } = req.body;
    
    const contact = await addContact(userId, contactIdentifier);
    
    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data: {
        contact: contact
      }
    });

  } catch (error) {
    console.error('Add contact error:', error);
    
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
    if (error.message === 'User not found with the provided username or email') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Handle self-add attempt
    if (error.message === 'Cannot add yourself as a contact') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: error.message
        }
      });
    }
    
    // Handle duplicate contact
    if (error.message === 'Contact already exists') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONTACT_EXISTS',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTACT_ADD_ERROR',
        message: 'Failed to add contact'
      }
    });
  }
});

/**
 * DELETE /api/contacts/:contactId
 * Remove a contact for the authenticated user
 */
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;
    
    const result = await removeContact(userId, contactId);
    
    res.json({
      success: true,
      message: result.message,
      data: {}
    });

  } catch (error) {
    console.error('Remove contact error:', error);
    
    // Handle validation errors
    if (error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        }
      });
    }
    
    // Handle contact not found
    if (error.message === 'Contact not found') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTACT_NOT_FOUND',
          message: error.message
        }
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTACT_REMOVE_ERROR',
        message: 'Failed to remove contact'
      }
    });
  }
});

module.exports = router;