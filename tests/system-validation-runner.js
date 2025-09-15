#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * System Validation Test Runner
 * 
 * This script runs comprehensive integration tests to validate the entire system
 * according to task 18 requirements:
 * - Complete user registration and login flow
 * - Contact management functionality end-to-end
 * - Real-time messaging between multiple users
 * - Dashboard statistics accuracy and display
 * - Responsive design across different devices
 * - Security testing and validation
 */

class SystemValidationRunner {
  constructor() {
    this.results = {
      backend: {},
      frontend: {},
      socket: {},
      security: {},
      responsive: {}
    };
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      reset: '\x1b[0m'     // Reset
    };
    
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runCommand(command, cwd = process.cwd()) {
    this.log(`Executing: ${command}`, 'info');
    
    try {
      const output = execSync(command, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 300000 // 5 minutes timeout
      });
      
      return { success: true, output };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        output: error.stdout || error.stderr || ''
      };
    }
  }

  async setupTestEnvironment() {
    this.log('Setting up test environment...', 'info');
    
    // Ensure test databases are ready
    const backendPath = path.join(process.cwd(), 'backend');
    
    if (fs.existsSync(backendPath)) {
      this.log('Setting up backend test database...', 'info');
      const setupResult = await this.runCommand('npm run test:setup', backendPath);
      
      if (!setupResult.success) {
        this.log('Failed to setup backend test environment', 'error');
        throw new Error('Backend test setup failed');
      }
    }

    // Install dependencies if needed
    const frontendPath = path.join(process.cwd(), 'frontend');
    
    if (fs.existsSync(frontendPath)) {
      this.log('Checking frontend dependencies...', 'info');
      const depsResult = await this.runCommand('npm ci', frontendPath);
      
      if (!depsResult.success) {
        this.log('Frontend dependency installation failed', 'warning');
      }
    }
  }

  async runBackendIntegrationTests() {
    this.log('Running backend integration tests...', 'info');
    
    const backendPath = path.join(process.cwd(), 'backend');
    
    if (!fs.existsSync(backendPath)) {
      this.log('Backend directory not found, skipping backend tests', 'warning');
      return { skipped: true };
    }

    const tests = [
      {
        name: 'System Validation Tests',
        command: 'npm test -- tests/integration/system-validation.test.js --run',
        description: 'Complete user flow and API validation'
      },
      {
        name: 'Socket.IO Integration Tests',
        command: 'npm test -- tests/integration/socket-system-validation.test.js --run',
        description: 'Real-time messaging validation'
      },
      {
        name: 'Security Validation Tests',
        command: 'npm test -- tests/integration/security-validation.test.js --run',
        description: 'Security and authentication validation'
      }
    ];

    for (const test of tests) {
      this.log(`Running ${test.name}...`, 'info');
      
      const result = await this.runCommand(test.command, backendPath);
      
      this.results.backend[test.name] = {
        success: result.success,
        output: result.output,
        error: result.error,
        description: test.description
      };

      if (result.success) {
        this.log(`✓ ${test.name} passed`, 'success');
      } else {
        this.log(`✗ ${test.name} failed`, 'error');
        this.log(`Error: ${result.error}`, 'error');
      }
    }
  }

  async runFrontendIntegrationTests() {
    this.log('Running frontend integration tests...', 'info');
    
    const frontendPath = path.join(process.cwd(), 'frontend');
    
    if (!fs.existsSync(frontendPath)) {
      this.log('Frontend directory not found, skipping frontend tests', 'warning');
      return { skipped: true };
    }

    const tests = [
      {
        name: 'System Integration Tests',
        command: 'npm test -- tests/integration/system-validation.test.jsx --run',
        description: 'Complete frontend user flow validation'
      },
      {
        name: 'Responsive Design Tests',
        command: 'npm test -- tests/integration/responsive-design.test.jsx --run',
        description: 'Cross-device responsive design validation'
      }
    ];

    for (const test of tests) {
      this.log(`Running ${test.name}...`, 'info');
      
      const result = await this.runCommand(test.command, frontendPath);
      
      this.results.frontend[test.name] = {
        success: result.success,
        output: result.output,
        error: result.error,
        description: test.description
      };

      if (result.success) {
        this.log(`✓ ${test.name} passed`, 'success');
      } else {
        this.log(`✗ ${test.name} failed`, 'error');
        this.log(`Error: ${result.error}`, 'error');
      }
    }
  }

  async runEndToEndTests() {
    this.log('Running end-to-end tests...', 'info');
    
    // Check if E2E tests exist
    const frontendPath = path.join(process.cwd(), 'frontend');
    const e2eTestPath = path.join(frontendPath, 'tests', 'e2e');
    
    if (!fs.existsSync(e2eTestPath)) {
      this.log('E2E tests directory not found, skipping E2E tests', 'warning');
      return { skipped: true };
    }

    const result = await this.runCommand('npm run test:e2e', frontendPath);
    
    this.results.e2e = {
      success: result.success,
      output: result.output,
      error: result.error,
      description: 'End-to-end user journey validation'
    };

    if (result.success) {
      this.log('✓ E2E tests passed', 'success');
    } else {
      this.log('✗ E2E tests failed', 'error');
    }
  }

  async validateSystemRequirements() {
    this.log('Validating system requirements...', 'info');
    
    const requirements = [
      {
        name: 'User Registration and Login Flow',
        tests: ['System Validation Tests'],
        category: 'backend'
      },
      {
        name: 'Contact Management End-to-End',
        tests: ['System Validation Tests'],
        category: 'backend'
      },
      {
        name: 'Real-time Messaging',
        tests: ['Socket.IO Integration Tests'],
        category: 'backend'
      },
      {
        name: 'Dashboard Statistics',
        tests: ['System Validation Tests'],
        category: 'backend'
      },
      {
        name: 'Responsive Design',
        tests: ['Responsive Design Tests'],
        category: 'frontend'
      },
      {
        name: 'Security Validation',
        tests: ['Security Validation Tests'],
        category: 'backend'
      }
    ];

    const validationResults = {};

    for (const requirement of requirements) {
      const testResults = requirement.tests.map(testName => {
        const categoryResults = this.results[requirement.category];
        return categoryResults && categoryResults[testName] ? categoryResults[testName].success : false;
      });

      validationResults[requirement.name] = {
        passed: testResults.every(result => result === true),
        tests: requirement.tests,
        category: requirement.category
      };
    }

    return validationResults;
  }

  generateReport() {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    this.log('Generating system validation report...', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      categories: {},
      requirements: this.validateSystemRequirements()
    };

    // Process results by category
    Object.keys(this.results).forEach(category => {
      const categoryResults = this.results[category];
      
      if (categoryResults.skipped) {
        report.categories[category] = { skipped: true };
        report.summary.skipped++;
        return;
      }

      const tests = Object.keys(categoryResults);
      const passed = tests.filter(test => categoryResults[test].success).length;
      const failed = tests.length - passed;

      report.categories[category] = {
        total: tests.length,
        passed,
        failed,
        tests: categoryResults
      };

      report.summary.total += tests.length;
      report.summary.passed += passed;
      report.summary.failed += failed;
    });

    return report;
  }

  printReport(report) {
    this.log('\n' + '='.repeat(80), 'info');
    this.log('SYSTEM VALIDATION REPORT', 'info');
    this.log('='.repeat(80), 'info');
    
    this.log(`\nExecution Time: ${report.duration}`, 'info');
    this.log(`Timestamp: ${report.timestamp}`, 'info');
    
    this.log('\nSUMMARY:', 'info');
    this.log(`Total Tests: ${report.summary.total}`, 'info');
    this.log(`Passed: ${report.summary.passed}`, 'success');
    this.log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'info');
    this.log(`Skipped: ${report.summary.skipped}`, 'warning');
    
    this.log('\nREQUIREMENT VALIDATION:', 'info');
    Object.keys(report.requirements).forEach(requirement => {
      const result = report.requirements[requirement];
      const status = result.passed ? '✓' : '✗';
      const color = result.passed ? 'success' : 'error';
      
      this.log(`${status} ${requirement}`, color);
    });

    this.log('\nCATEGORY BREAKDOWN:', 'info');
    Object.keys(report.categories).forEach(category => {
      const categoryResult = report.categories[category];
      
      if (categoryResult.skipped) {
        this.log(`${category.toUpperCase()}: SKIPPED`, 'warning');
        return;
      }

      this.log(`\n${category.toUpperCase()}:`, 'info');
      this.log(`  Total: ${categoryResult.total}`, 'info');
      this.log(`  Passed: ${categoryResult.passed}`, 'success');
      this.log(`  Failed: ${categoryResult.failed}`, categoryResult.failed > 0 ? 'error' : 'info');
      
      Object.keys(categoryResult.tests).forEach(testName => {
        const test = categoryResult.tests[testName];
        const status = test.success ? '✓' : '✗';
        const color = test.success ? 'success' : 'error';
        
        this.log(`    ${status} ${testName}`, color);
        if (test.description) {
          this.log(`      ${test.description}`, 'info');
        }
      });
    });

    this.log('\n' + '='.repeat(80), 'info');
    
    const overallSuccess = report.summary.failed === 0 && report.summary.total > 0;
    if (overallSuccess) {
      this.log('SYSTEM VALIDATION PASSED ✓', 'success');
    } else {
      this.log('SYSTEM VALIDATION FAILED ✗', 'error');
    }
    
    this.log('='.repeat(80), 'info');
  }

  async saveReport(report) {
    const reportPath = path.join(process.cwd(), 'system-validation-report.json');
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      this.log(`Report saved to: ${reportPath}`, 'success');
    } catch (error) {
      this.log(`Failed to save report: ${error.message}`, 'error');
    }
  }

  async run() {
    try {
      this.log('Starting system validation...', 'info');
      
      await this.setupTestEnvironment();
      await this.runBackendIntegrationTests();
      await this.runFrontendIntegrationTests();
      await this.runEndToEndTests();
      
      const report = this.generateReport();
      this.printReport(report);
      await this.saveReport(report);
      
      const success = report.summary.failed === 0 && report.summary.total > 0;
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      this.log(`System validation failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SystemValidationRunner();
  runner.run();
}

module.exports = SystemValidationRunner;