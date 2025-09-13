const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 * Query params: search (optional) - filter contacts by name or email
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { search } = req.query;

    let query = `
      SELECT 
        c.id as contact_id,
        u.id,
        u.name,
        u.email,
        u.last_seen,
        c.created_at as contact_added_at,
        CASE 
          WHEN u.last_seen > NOW() - INTERVAL '5 minutes' THEN true 
          ELSE false 
        END as is_online
      FROM contacts c
      JOIN users u ON c.contact_user_id = u.id
      WHERE c.user_id = $1
    `;
    
    const queryParams = [userId];

    // Add search functionality if search parameter is provided
    if (search && search.trim()) {
      query += ` AND (u.name ILIKE $2 OR u.email ILIKE $2)`;
      queryParams.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY u.name ASC`;

    const result = await pool.query(query, queryParams);

    const contacts = result.rows.map(row => ({
      id: row.id,
      contactId: row.contact_id,
      name: row.name,
      email: row.email,
      lastSeen: row.last_seen,
      contactAddedAt: row.contact_added_at,
      isOnline: row.is_online
    }));

    res.json({
      success: true,
      data: {
        contacts,
        total: contacts.length
      }
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_CONTACTS_ERROR',
        message: 'Failed to fetch contacts'
      }
    });
  }
});

/**
 * POST /api/contacts
 * Add a new contact for the authenticated user
 * Body: { email } - email of the user to add as contact
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
          details: { field: 'email' }
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user is trying to add themselves
    if (normalizedEmail === req.user.email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cannot add yourself as a contact',
          details: { field: 'email' }
        }
      });
    }

    // Find the user to add as contact
    const userQuery = 'SELECT id, name, email, last_seen FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [normalizedEmail]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User with this email does not exist'
        }
      });
    }

    const contactUser = userResult.rows[0];

    // Check if contact relationship already exists
    const existingContactQuery = `
      SELECT id FROM contacts 
      WHERE user_id = $1 AND contact_user_id = $2
    `;
    const existingResult = await pool.query(existingContactQuery, [userId, contactUser.id]);

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONTACT_EXISTS',
          message: 'This user is already in your contacts'
        }
      });
    }

    // Add the contact relationship
    const insertQuery = `
      INSERT INTO contacts (user_id, contact_user_id)
      VALUES ($1, $2)
      RETURNING id, created_at
    `;
    const insertResult = await pool.query(insertQuery, [userId, contactUser.id]);

    const newContact = {
      id: contactUser.id,
      contactId: insertResult.rows[0].id,
      name: contactUser.name,
      email: contactUser.email,
      lastSeen: contactUser.last_seen,
      contactAddedAt: insertResult.rows[0].created_at,
      isOnline: new Date(contactUser.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
    };

    res.status(201).json({
      success: true,
      data: {
        contact: newContact,
        message: 'Contact added successfully'
      }
    });

  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ADD_CONTACT_ERROR',
        message: 'Failed to add contact'
      }
    });
  }
});

/**
 * DELETE /api/contacts/:contactId
 * Remove a contact from the authenticated user's contact list
 */
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contactId } = req.params;

    // Validate contactId
    if (!contactId || isNaN(parseInt(contactId))) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid contact ID'
        }
      });
    }

    // Check if contact exists and belongs to the user
    const checkQuery = `
      SELECT id FROM contacts 
      WHERE id = $1 AND user_id = $2
    `;
    const checkResult = await pool.query(checkQuery, [contactId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTACT_NOT_FOUND',
          message: 'Contact not found or does not belong to you'
        }
      });
    }

    // Delete the contact
    const deleteQuery = 'DELETE FROM contacts WHERE id = $1 AND user_id = $2';
    await pool.query(deleteQuery, [contactId, userId]);

    res.json({
      success: true,
      data: {
        message: 'Contact removed successfully'
      }
    });

  } catch (error) {
    console.error('Error removing contact:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REMOVE_CONTACT_ERROR',
        message: 'Failed to remove contact'
      }
    });
  }
});

module.exports = router;