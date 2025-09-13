const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');

const router = express.Router();

/**
 * GET /api/users/profile
 * Get the authenticated user's profile information
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, name, email, created_at, updated_at, last_seen
      FROM users 
      WHERE id = $1
    `;
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found'
        }
      });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastSeen: user.last_seen
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PROFILE_ERROR',
        message: 'Failed to fetch user profile'
      }
    });
  }
});

/**
 * PUT /api/users/profile
 * Update the authenticated user's profile information
 * Body: { name?, email? } - optional fields to update
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    // Validate that at least one field is provided
    if (!name && !email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (name or email) must be provided for update'
        }
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    if (name && name.trim()) {
      updates.push(`name = $${paramCount}`);
      values.push(name.trim());
      paramCount++;
    }

    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      const emailCheckQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
      const emailCheckResult = await pool.query(emailCheckQuery, [normalizedEmail, userId]);
      
      if (emailCheckResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'This email is already registered to another user'
          }
        });
      }

      updates.push(`email = $${paramCount}`);
      values.push(normalizedEmail);
      paramCount++;
    }

    // Add user ID as the last parameter
    values.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, name, email, created_at, updated_at, last_seen
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at,
          lastSeen: updatedUser.last_seen
        },
        message: 'Profile updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message: 'Failed to update user profile'
      }
    });
  }
});

/**
 * PUT /api/users/password
 * Update the authenticated user's password
 * Body: { currentPassword, newPassword }
 */
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Both current password and new password are required'
        }
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New password must be at least 6 characters long'
        }
      });
    }

    // Get current password hash
    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Verify current password
    const bcrypt = require('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect'
        }
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await pool.query(updateQuery, [newPasswordHash, userId]);

    res.json({
      success: true,
      data: {
        message: 'Password updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PASSWORD_ERROR',
        message: 'Failed to update password'
      }
    });
  }
});

/**
 * PUT /api/users/last-seen
 * Update the authenticated user's last seen timestamp
 */
router.put('/last-seen', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const updateQuery = `
      UPDATE users 
      SET last_seen = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING last_seen
    `;
    const result = await pool.query(updateQuery, [userId]);

    res.json({
      success: true,
      data: {
        lastSeen: result.rows[0].last_seen
      }
    });

  } catch (error) {
    console.error('Error updating last seen:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_LAST_SEEN_ERROR',
        message: 'Failed to update last seen timestamp'
      }
    });
  }
});

module.exports = router;