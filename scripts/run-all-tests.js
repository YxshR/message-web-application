#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args, cwd, description) {
  return new Promise((resolve, reject) => {
    log(`\n${description}`, 'cyan');
    log(`Running: ${command} ${args.join(' ')}`, 'yellow');
    
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${description} completed successfully`, 'green');
        resolve();
      } else {
        log(`❌ ${description} failed with code ${code}`, 'red');
        reject(new Error(`${description} failed`));
      }
    });

    child.on('error', (error) => {
      log(`❌ ${description} error: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function runAllTests() {
  const rootDir = path.join(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');

  log('🚀 Starting comprehensive test suite', 'bright');
  log('=====================================', 'bright');

  const testResults = {
    passed: [],
    failed: [],
    startTime: Date.now()
  };

  const tests = [
    {
      name: 'Backend Unit Tests',
      command: 'npm',
      args: ['run', 'test:unit'],
      cwd: backendDir
    },
    {
      name: 'Backend Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration'],
      cwd: backendDir
    },
    {
      name: 'Backend Coverage Report',
      command: 'npm',
      args: ['run', 'test:coverage'],
      cwd: backendDir
    },
    {
      name: 'Frontend Unit Tests',
      command: 'npm',
      args: ['run', 'test:coverage'],
      cwd: frontendDir
    },
    {
      name: 'Database Structure Tests',
      command: 'npm',
      args: ['run', 'test:structure'],
      cwd: backendDir
    }
  ];

  // Run tests sequentially
  for (const test of tests) {
    try {
      await runCommand(test.command, test.args, test.cwd, test.name);
      testResults.passed.push(test.name);
    } catch (error) {
      testResults.failed.push({ name: test.name, error: error.message });
    }
  }

  // Optional performance tests (may take longer)
  if (process.argv.includes('--performance')) {
    try {
      await runCommand('npm', ['run', 'test:performance'], backendDir, 'Performance Tests');
      testResults.passed.push('Performance Tests');
    } catch (error) {
      testResults.failed.push({ name: 'Performance Tests', error: error.message });
    }
  }

  // Optional E2E tests (requires running servers)
  if (process.argv.includes('--e2e')) {
    try {
      await runCommand('npm', ['run', 'test:e2e'], frontendDir, 'E2E Tests');
      testResults.passed.push('E2E Tests');
    } catch (error) {
      testResults.failed.push({ name: 'E2E Tests', error: error.message });
    }
  }

  // Generate test report
  const endTime = Date.now();
  const duration = (endTime - testResults.startTime) / 1000;

  log('\n📊 Test Results Summary', 'bright');
  log('=======================', 'bright');
  log(`Total Duration: ${duration.toFixed(2)} seconds`, 'blue');
  log(`Passed: ${testResults.passed.length}`, 'green');
  log(`Failed: ${testResults.failed.length}`, testResults.failed.length > 0 ? 'red' : 'green');

  if (testResults.passed.length > 0) {
    log('\n✅ Passed Tests:', 'green');
    testResults.passed.forEach(test => log(`  - ${test}`, 'green'));
  }

  if (testResults.failed.length > 0) {
    log('\n❌ Failed Tests:', 'red');
    testResults.failed.forEach(test => log(`  - ${test.name}: ${test.error}`, 'red'));
  }

  // Generate coverage report summary
  try {
    const backendCoverage = path.join(backendDir, 'coverage', 'coverage-summary.json');
    const frontendCoverage = path.join(frontendDir, 'coverage', 'coverage-summary.json');

    if (fs.existsSync(backendCoverage)) {
      const backendData = JSON.parse(fs.readFileSync(backendCoverage, 'utf8'));
      log('\n📈 Backend Coverage:', 'blue');
      log(`  Lines: ${backendData.total.lines.pct}%`, 'blue');
      log(`  Functions: ${backendData.total.functions.pct}%`, 'blue');
      log(`  Branches: ${backendData.total.branches.pct}%`, 'blue');
      log(`  Statements: ${backendData.total.statements.pct}%`, 'blue');
    }

    if (fs.existsSync(frontendCoverage)) {
      const frontendData = JSON.parse(fs.readFileSync(frontendCoverage, 'utf8'));
      log('\n📈 Frontend Coverage:', 'blue');
      log(`  Lines: ${frontendData.total.lines.pct}%`, 'blue');
      log(`  Functions: ${frontendData.total.functions.pct}%`, 'blue');
      log(`  Branches: ${frontendData.total.branches.pct}%`, 'blue');
      log(`  Statements: ${frontendData.total.statements.pct}%`, 'blue');
    }
  } catch (error) {
    log('⚠️  Could not read coverage reports', 'yellow');
  }

  // Exit with appropriate code
  if (testResults.failed.length > 0) {
    log('\n💥 Some tests failed!', 'red');
    process.exit(1);
  } else {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  log('Comprehensive Test Runner', 'bright');
  log('Usage: node scripts/run-all-tests.js [options]', 'blue');
  log('Options:', 'blue');
  log('  --performance  Include performance tests', 'blue');
  log('  --e2e         Include E2E tests (requires servers to be running)', 'blue');
  log('  --help        Show this help message', 'blue');
  process.exit(0);
}

// Run the tests
runAllTests().catch((error) => {
  log(`💥 Test runner failed: ${error.message}`, 'red');
  process.exit(1);
});