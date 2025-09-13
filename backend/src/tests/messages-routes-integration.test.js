const request = require('supertest');
const express = require('express');

// Mock the database and auth middleware for integration testing
jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@example.com' };
    next();
  })
}));

describe('Messages API Routes Integration', () => {
  let app;

  beforeAll(() => {
    // Create a minimal Express app with our routes
    app = express();
    app.use(express.json());
    
    // Import and use the messages routes
    const messageRoutes = require('../routes/messages');
    app.use('/api/messages', messageRoutes);
  });

  test('should have all required message endpoints', async () => {
    const { pool } = require('../config/database');
    
    // Test POST /api/messages endpoint exists
    pool.query.mockResolvedValueOnce({ rows: [] }); // recipient not found
    const postResponse = await request(app)
      .post('/api/messages')
      .send({ recipientId: 999, content: 'test' });
    
    expect(postResponse.status).toBe(404); // Route exists and returns proper error
    
    // Test GET /api/messages/:contactId endpoint exists
    pool.query.mockResolvedValueOnce({ rows: [] }); // contact not found
    const getResponse = await request(app)
      .get('/api/messages/999');
    
    expect(getResponse.status).toBe(404); // Route exists and returns proper error
    
    // Test PUT /api/messages/:messageId/read endpoint exists
    pool.query.mockResolvedValueOnce({ rows: [] }); // message not found
    const putResponse = await request(app)
      .put('/api/messages/999/read');
    
    expect(putResponse.status).toBe(404); // Route exists and returns proper error
    
    // Test GET /api/messages/unread/count endpoint exists
    pool.query.mockResolvedValueOnce({ rows: [{ unread_count: '0' }] });
    const countResponse = await request(app)
      .get('/api/messages/unread/count');
    
    expect(countResponse.status).toBe(200); // Route works
    expect(countResponse.body.success).toBe(true);
  });

  test('should return proper JSON error responses', async () => {
    const response = await request(app)
      .post('/api/messages')
      .send({});

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body.error).toHaveProperty('message');
  });

  test('should handle pagination parameters correctly', async () => {
    const { pool } = require('../config/database');
    
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Contact', email: 'contact@example.com' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const response = await request(app)
      .get('/api/messages/2?page=2&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toMatchObject({
      currentPage: 2,
      limit: 10
    });
  });

  test('should enforce maximum limit for pagination', async () => {
    const { pool } = require('../config/database');
    
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Contact', email: 'contact@example.com' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const response = await request(app)
      .get('/api/messages/2?limit=200'); // Requesting more than max (100)

    expect(response.status).toBe(200);
    expect(response.body.data.pagination.limit).toBe(100); // Should be capped at 100
  });
});