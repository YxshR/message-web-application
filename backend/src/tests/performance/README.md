# API Reliability Load Testing Suite

This comprehensive load testing suite validates the API reliability optimization features implemented for the messaging application. The suite tests all requirements from the API reliability optimization specification and provides continuous monitoring capabilities.

## Overview

The load testing suite consists of multiple test categories designed to validate different aspects of API reliability:

### 🔄 Request Deduplication Tests
- **File**: `concurrent-contacts-load.test.js`
- **Purpose**: Validates request deduplication effectiveness under various load scenarios
- **Requirements**: 1.1, 1.2, 1.3, 3.1, 3.3

### 🏊 Connection Pool Tests  
- **File**: `connection-pool-load.test.js`
- **Purpose**: Tests connection pool saturation, recovery, and resource management
- **Requirements**: 2.1, 2.2, 2.3

### 🔥 Chaos Engineering Tests
- **File**: `chaos-engineering.test.js` 
- **Purpose**: Simulates failure scenarios and validates system resilience
- **Requirements**: 2.1-2.3, 3.1-3.4, 4.1-4.4, 5.1-5.4

### 📊 Continuous Monitoring Tests
- **File**: `continuous-reliability-monitoring.test.js`
- **Purpose**: Provides ongoing system health and performance monitoring
- **Requirements**: All requirements validation

### 🎯 Artillery Load Tests
- **File**: `api-reliability-load-test.yml`
- **Purpose**: High-volume load testing with realistic user scenarios
- **Requirements**: All requirements under realistic load

### 📈 Frontend Deduplication Benchmarks
- **File**: `frontend/src/__tests__/performance/deduplication-benchmarks.test.ts`
- **Purpose**: Frontend-specific deduplication performance testing
- **Requirements**: 1.3, 3.2

## Quick Start

### Run All Load Tests
```bash
cd backend
npm run test:load
```

### Run Individual Test Suites
```bash
# Concurrent contacts load testing
npm run test:load:concurrent

# Chaos engineering tests
npm run test:load:chaos

# Continuous monitoring tests  
npm run test:load:monitoring

# Artillery load tests
npm run test:load:artillery

# All reliability tests (Jest only)
npm run test:reliability
```

### Run Frontend Deduplication Tests
```bash
cd frontend
npm run test:deduplication
```

## Test Categories

### 1. Concurrent Contacts Fetching Tests

**File**: `concurrent-contacts-load.test.js`

Tests the system's ability to handle concurrent requests for the contacts API:

- **Request Deduplication Effectiveness**: Validates that identical concurrent requests are deduplicated
- **Connection Pool Saturation**: Tests graceful handling when connection pool is exhausted
- **Resource Exhaustion Recovery**: Validates recovery from ERR_INSUFFICIENT_RESOURCES errors
- **Performance Benchmarks**: Ensures response times meet requirements (P95 < 5s, P99 < 10s)

**Key Metrics**:
- Deduplication effectiveness percentage
- Connection pool utilization
- Response time percentiles
- Throughput (requests/second)
- Error rates and recovery times

### 2. Chaos Engineering Tests

**File**: `chaos-engineering.test.js`

Simulates various failure scenarios to test system resilience:

- **Database Connection Chaos**: Simulates connection drops and recovery
- **Memory Pressure Simulation**: Tests behavior under memory constraints  
- **Network Latency Chaos**: Validates handling of network delays
- **Concurrent User Chaos**: Tests authentication and session management under stress
- **Resource Recovery Tests**: Validates full system recovery after chaos

**Chaos Scenarios**:
- Sudden connection drops
- Connection pool exhaustion
- Memory pressure from large payloads
- Network delays and timeouts
- Authentication storms
- Mixed failure conditions

### 3. Continuous Reliability Monitoring

**File**: `continuous-reliability-monitoring.test.js`

Provides ongoing monitoring and alerting capabilities:

- **Health Check Monitoring**: Comprehensive system health validation
- **Performance Baseline Monitoring**: Establishes and tracks performance baselines
- **Deduplication Effectiveness Monitoring**: Ongoing deduplication performance tracking
- **Resource Exhaustion Recovery Monitoring**: Monitors recovery patterns
- **Alerting and Threshold Monitoring**: Detects performance degradation
- **Monitoring Report Generation**: Creates comprehensive monitoring reports

**Monitoring Features**:
- Automated health checks
- Performance trend analysis
- Threshold violation detection
- Historical data tracking
- Automated alerting
- Report generation

### 4. Artillery Load Tests

**File**: `api-reliability-load-test.yml`

High-volume load testing with realistic user scenarios:

**Test Phases**:
1. **Baseline** (30s @ 5 req/s): Normal load baseline
2. **Ramp-up** (60s @ 20 req/s): Test deduplication under increasing load
3. **High Concurrency** (120s @ 50 req/s): Connection pool stress testing
4. **Resource Exhaustion** (180s @ 100 req/s): Stress test with resource exhaustion
5. **Recovery** (60s @ 10 req/s): Post-stress recovery validation

**Scenarios**:
- **Concurrent Contacts Fetching** (40%): Multiple rapid contacts requests
- **Mixed API Operations** (30%): Various API endpoints under load
- **Authentication Stress** (20%): Authentication system load testing
- **Resource Exhaustion Simulation** (10%): Aggressive resource consumption

### 5. Frontend Deduplication Benchmarks

**File**: `frontend/src/__tests__/performance/deduplication-benchmarks.test.ts`

Frontend-specific performance testing:

- **Request Deduplication Effectiveness**: Measures performance improvement from deduplication
- **Memory and Performance Impact**: Validates memory usage under high load
- **Error Handling and Recovery**: Tests deduplication behavior during failures
- **Real-world Simulation**: Simulates realistic user behavior patterns

## Performance Thresholds

The test suite validates the following performance requirements:

### Response Time Requirements
- **P95 Response Time**: < 5 seconds
- **P99 Response Time**: < 10 seconds  
- **Average Response Time**: < 1 second (normal load)
- **Concurrent Average**: < 2 seconds (concurrent load)

### Throughput Requirements
- **Minimum Throughput**: > 10 requests/second
- **Sustained Throughput**: > 5 requests/second (sustained load)
- **Connection Pool**: Handle 2x max connections gracefully

### Reliability Requirements
- **Success Rate**: > 95% under normal load
- **Graceful Degradation**: > 70% success under stress
- **Recovery Time**: < 10 seconds after resource exhaustion
- **Deduplication Effectiveness**: > 50% request reduction

### System Health Requirements
- **Health Score**: > 80% overall system health
- **Error Rate**: < 5% database error rate
- **Connection Pool**: No hanging clients after tests

## Test Configuration

### Environment Setup

The tests require the following environment setup:

```bash
# Backend setup
cd backend
npm install
cp .env.test.example .env.test
npm run db:setup

# Frontend setup  
cd frontend
npm install
```

### Database Configuration

Tests use a dedicated test database:

```env
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_NAME=messaging_app_test
DB_USER=postgres
DB_PASSWORD=postgres
```

### Test Data

Tests automatically create and clean up test data:
- 5-20 test users per test suite
- 10-50 test contacts per user
- Automatic cleanup after each test

## Monitoring and Reporting

### Automated Reports

The test suite generates comprehensive reports:

- **JSON Report**: Detailed test results and metrics (`load-test-report-*.json`)
- **Markdown Summary**: Human-readable summary (`load-test-summary-*.md`)
- **Monitoring Results**: Continuous monitoring data (`monitoring-results.json`)

### Key Metrics Tracked

- **Performance Metrics**: Response times, throughput, error rates
- **Deduplication Metrics**: Cache hit ratios, request reduction percentages
- **Resource Metrics**: Connection pool utilization, memory usage
- **Reliability Metrics**: Success rates, recovery times, health scores

### Alerting

The monitoring system generates alerts for:
- Performance degradation (>20% slower than baseline)
- High error rates (>5%)
- Low throughput (<10 req/s)
- Poor health scores (<80%)
- Threshold violations

## CI/CD Integration

### GitHub Actions

Add to your workflow:

```yaml
- name: Run API Reliability Load Tests
  run: |
    cd backend
    npm run test:load
  timeout-minutes: 30

- name: Run Frontend Deduplication Tests  
  run: |
    cd frontend
    npm run test:deduplication
  timeout-minutes: 10
```

### Performance Gates

Use exit codes to gate deployments:
- Exit code 0: All tests passed
- Exit code 1: One or more tests failed

### Artifacts

Save test reports as CI artifacts:
```yaml
- name: Upload Load Test Reports
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: load-test-reports
    path: backend/src/tests/performance/load-test-*.json
```

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Reset test database
npm run migrate:rollback
npm run migrate
npm run seed
```

#### Port Conflicts
```bash
# Kill processes on test ports
lsof -ti:5000 | xargs kill -9
lsof -ti:5001 | xargs kill -9
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Test Timeouts
Increase timeouts in Jest configuration:
```javascript
// jest.config.js
module.exports = {
  testTimeout: 300000, // 5 minutes
};
```

### Performance Issues

#### Slow Test Execution
- Reduce concurrent request counts in tests
- Use `--runInBand` flag for Jest tests
- Optimize database queries and indexes

#### High Memory Usage
- Implement proper cleanup in test teardown
- Reduce test data size
- Use connection pooling efficiently

#### Flaky Tests
- Add proper wait conditions
- Implement retry logic for network operations
- Use deterministic test data

## Best Practices

### Test Development
- Keep tests focused on specific scenarios
- Use realistic test data and patterns
- Implement proper cleanup and isolation
- Add comprehensive logging and metrics

### Performance Testing
- Establish baselines before making changes
- Test under various load conditions
- Monitor resource usage during tests
- Validate both success and failure scenarios

### Monitoring
- Set appropriate thresholds for your system
- Track trends over time
- Implement automated alerting
- Regular review of monitoring data

## Contributing

When adding new load tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Add Documentation**: Update this README with new test descriptions
3. **Include Metrics**: Ensure tests track relevant performance metrics
4. **Validate Requirements**: Map tests to specific requirements
5. **Add Cleanup**: Implement proper test data cleanup
6. **Update Scripts**: Add new test scripts to package.json

### Test Template

```javascript
describe('New Load Test Category', () => {
  let server;
  let testUsers = [];
  
  beforeAll(async () => {
    // Setup test environment
  });
  
  afterAll(async () => {
    // Cleanup resources
  });
  
  test('should validate specific requirement', async () => {
    // Test implementation
    // Include performance assertions
    // Log relevant metrics
  });
});
```

## Support

For issues with the load testing suite:

1. Check the troubleshooting section above
2. Review test logs for specific error messages
3. Validate environment setup and configuration
4. Check system resources (memory, CPU, disk)
5. Ensure database is properly configured and accessible

## License

This load testing suite is part of the messaging application project and follows the same license terms.