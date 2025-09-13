const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Test routes - only available in test environment
if (process.env.NODE_ENV === 'test') {
  
  // Reset database for testing
  router.post('/reset-db', async (req, res) => {
    try {
      // Delete all data in correct order to respect foreign key constraints
      await db.query('DELETE FROM messages');
      await db.query('DELETE FROM contacts');
      await db.query('DELETE FROM users');
      
      // Reset sequences
      await db.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
      await db.query('ALTER SEQUENCE contacts_id_seq RESTART WITH 1');
      await db.query('ALTER SEQUENCE messages_id_seq RESTART WITH 1');
      
      res.json({ success: true, message: 'Database reset successfully' });
    } catch (error) {
      console.error('Database reset error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reset database',
        details: error.message 
      });
    }
  });

  // Create test users for E2E testing
  router.post('/create-test-users', async (req, res) => {
    try {
      const bcrypt = require('bcrypt');
      const testUsers = [
        { name: 'Test User 1', email: 'test1@example.com', password: 'password123' },
        { name: 'Test User 2', email: 'test2@example.com', password: 'password123' },
        { name: 'Test User 3', email: 'test3@example.com', password: 'password123' }
      ];

      const createdUsers = [];
      
      for (const userData of testUsers) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const result = await db.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
          [userData.name, userData.email, hashedPassword]
        );
        createdUsers.push(result.rows[0]);
      }

      res.json({ 
        success: true, 
        users: createdUsers,
        message: 'Test users created successfully' 
      });
    } catch (error) {
      console.error('Test user creation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create test users',
        details: error.message 
      });
    }
  });

  // Get database statistics for testing
  router.get('/db-stats', async (req, res) => {
    try {
      const userCount = await db.query('SELECT COUNT(*) FROM users');
      const contactCount = await db.query('SELECT COUNT(*) FROM contacts');
      const messageCount = await db.query('SELECT COUNT(*) FROM messages');

      res.json({
        success: true,
        stats: {
          users: parseInt(userCount.rows[0].count),
          contacts: parseInt(contactCount.rows[0].count),
          messages: parseInt(messageCount.rows[0].count)
        }
      });
    } catch (error) {
      console.error('Database stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get database stats',
        details: error.message 
      });
    }
  });

} else {
  // In non-test environments, return 404 for all test routes
  router.use('*', (req, res) => {
    res.status(404).json({ error: 'Test routes not available in this environment' });
  });
}

module.exports = router;