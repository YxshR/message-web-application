const request = require('supertest');
const { getPoolHealth } = require('../config/database');

describe('Health Functions', () => {

  describe('Pool Health Function', () => {
    test('should return pool health metrics', () => {
      const health = getPoolHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('pool');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('timestamp');
      
      expect(health.pool).toHaveProperty('totalConnections');
      expect(health.pool).toHaveProperty('idleConnections');
      expect(health.pool).toHaveProperty('waitingClients');
      expect(health.pool).toHaveProperty('queueSize');
      
      expect(health.metrics).toHaveProperty('totalQueries');
      expect(health.metrics).toHaveProperty('totalErrors');
      expect(health.metrics).toHaveProperty('errorRate');
      expect(health.metrics).toHaveProperty('averageQueryTime');
    });
  });
});