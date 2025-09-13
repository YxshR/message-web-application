const request = require('supertest');
const { app } = require('../../server');

// Mock the database module
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

// Mock the auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    };
    next();
  }
}));

const { pool } = require('../config/database');

describe('Contact Management APIs - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/contacts', () => {
    test('should return empty contacts list', async () => {
      pool.query.mockResolvedValueOnce({
        rows: []
      });

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toEqual([]);
      expect(response.body.data.total).toBe(0);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    test('should return contacts list with data', async () => {
      const mockContacts = [
        {
          id: 2,
          contact_id: 1,
          name: 'Contact User',
          email: 'contact@example.com',
          last_seen: new Date(),
          contact_added_at: new Date(),
          is_online: true
        }
      ];

      pool.query.mockResolvedValueOnce({
        rows: mockContacts
      });

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contacts).toHaveLength(1);
      expect(response.body.data.contacts[0]).toMatchObject({
        id: 2,
        contactId: 1,
        name: 'Contact User',
        email: 'contact@example.com',
        isOnline: true
      });
    });

    test('should filter contacts by search query', async () => {
      pool.query.mockResolvedValueOnce({
        rows: []
      });

      await request(app)
        .get('/api/contacts?search=John')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        [1, '%John%']
      );
    });

    test('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FETCH_CONTACTS_ERROR');
    });
  });

  describe('POST /api/contacts', () => {
    test('should add a new contact successfully', async () => {
      const mockUser = {
        id: 2,
        name: 'New Contact',
        email: 'newcontact@example.com',
        last_seen: new Date()
      };

      // Mock user lookup
      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by email
        .mockResolvedValueOnce({ rows: [] }) // Check existing contact
        .mockResolvedValueOnce({ // Insert contact
          rows: [{ id: 1, created_at: new Date() }]
        });

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'newcontact@example.com' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contact).toMatchObject({
        id: 2,
        name: 'New Contact',
        email: 'newcontact@example.com'
      });
      expect(response.body.data.message).toBe('Contact added successfully');
    });

    test('should reject adding non-existent user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('should reject adding self as contact', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'test@example.com' }) // Same as authenticated user
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Cannot add yourself as a contact');
    });

    test('should reject duplicate contact', async () => {
      const mockUser = {
        id: 2,
        name: 'Existing Contact',
        email: 'existing@example.com',
        last_seen: new Date()
      };

      pool.query
        .mockResolvedValueOnce({ rows: [mockUser] }) // Find user by email
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Contact already exists

      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .send({ email: 'existing@example.com' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_EXISTS');
    });

    test('should validate required email field', async () => {
      const response = await request(app)
        .post('/api/contacts')
        .set('Authorization', 'Bearer mock-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Email is required');
    });
  });

  describe('DELETE /api/contacts/:contactId', () => {
    test('should remove contact successfully', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Contact exists
        .mockResolvedValueOnce({ rows: [] }); // Delete successful

      const response = await request(app)
        .delete('/api/contacts/1')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Contact removed successfully');
    });

    test('should reject removing non-existent contact', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // Contact not found

      const response = await request(app)
        .delete('/api/contacts/999')
        .set('Authorization', 'Bearer mock-token')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONTACT_NOT_FOUND');
    });

    test('should validate contact ID parameter', async () => {
      const response = await request(app)
        .delete('/api/contacts/invalid-id')
        .set('Authorization', 'Bearer mock-token')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});