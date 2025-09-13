#!/usr/bin/env node

/**
 * Comprehensive Load Test Runner
 * 
 * Orchestrates all API reliability load tests and generates comprehensive reports.
 * This script can be run manually or as part of CI/CD pipeline.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class LoadTestRunner {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      endTime: null,
      tests: {},
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        totalDuration: 0
      },
      performance: {
        deduplicationEffectiveness: null,
        connectionPoolPerformance: null,
        resourceExhaustionRecovery: null,
        chaosEngineeringResults: null,
        continuousMonitoringResults: null
      },
      recommendations: []
    };
  }

  async runTest(testName, testFile, timeout = 300000) {
    console.log(`\n🚀 Running ${testName}...`);
    console.log(`📁 Test file: ${testFile}`);
    console.log(`⏱️  Timeout: ${timeout / 1000}s`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const jest = spawn('npx', ['jest', testFile, '--verbose', '--detectOpenHandles'], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '../..'),
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      jest.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      jest.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const result = {
          name: testName,
          file: testFile,
          exitCode: code,
          duration: duration,
          stdout: stdout,
          stderr: stderr,
          status: code === 0 ? 'passed' : 'failed',
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString()
        };

        this.results.tests[testName] = result;
        this.results.summary.totalTests++;
        
        if (code === 0) {
          this.results.summary.passedTests++;
          console.log(`✅ ${testName} completed successfully in ${duration}ms`);
        } else {
          this.results.summary.failedTests++;
          console.log(`❌ ${testName} failed with exit code ${code} after ${duration}ms`);
        }
        
        this.results.summary.totalDuration += duration;
        resolve(result);
      });

      jest.on('error', (error) => {
        console.error(`💥 Error running ${testName}:`, error.message);
        
        const result = {
          name: testName,
          file: testFile,
          exitCode: -1,
          duration: Date.now() - startTime,
          error: error.message,
          status: 'error'
        };
        
        this.results.tests[testName] = result;
        this.results.summary.totalTests++;
        this.results.summary.failedTests++;
        resolve(result);
      });
    });
  }

  async runArtilleryTest(testName, configFile) {
    console.log(`\n🎯 Running Artillery test: ${testName}...`);
    console.log(`📁 Config file: ${configFile}`);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const artillery = spawn('npx', ['artillery', 'run', configFile], {
        stdio: 'pipe',
        cwd: __dirname
      });

      let stdout = '';
      let stderr = '';

      artillery.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(output);
      });

      artillery.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(output);
      });

      artillery.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const result = {
          name: testName,
          file: configFile,
          exitCode: code,
          duration: duration,
          stdout: stdout,
          stderr: stderr,
          status: code === 0 ? 'passed' : 'failed',
          type: 'artillery'
        };

        this.results.tests[testName] = result;
        this.results.summary.totalTests++;
        
        if (code === 0) {
          this.results.summary.passedTests++;
          console.log(`✅ ${testName} completed successfully in ${duration}ms`);
        } else {
          this.results.summary.failedTests++;
          console.log(`❌ ${testName} failed with exit code ${code} after ${duration}ms`);
        }
        
        this.results.summary.totalDuration += duration;
        resolve(result);
      });
    });
  }

  extractPerformanceMetrics() {
    console.log('\n📊 Extracting performance metrics...');
    
    // Extract deduplication effectiveness
    const deduplicationTest = this.results.tests['Deduplication Benchmarks'];
    if (deduplicationTest && deduplicationTest.status === 'passed') {
      // Parse stdout for deduplication metrics
      const deduplicationMatch = deduplicationTest.stdout.match(/Deduplication effectiveness: ([\d.]+)%/);
      if (deduplicationMatch) {
        this.results.performance.deduplicationEffectiveness = parseFloat(deduplicationMatch[1]);
      }
    }

    // Extract connection pool performance
    const connectionPoolTest = this.results.tests['Concurrent Contacts Load'];
    if (connectionPoolTest && connectionPoolTest.status === 'passed') {
      const throughputMatch = connectionPoolTest.stdout.match(/Throughput: ([\d.]+) req\/s/);
      if (throughputMatch) {
        this.results.performance.connectionPoolPerformance = {
          throughput: parseFloat(throughputMatch[1])
        };
      }
    }

    // Extract chaos engineering results
    const chaosTest = this.results.tests['Chaos Engineering'];
    if (chaosTest && chaosTest.status === 'passed') {
      this.results.performance.chaosEngineeringResults = {
        systemResilience: 'good', // Could be parsed from output
        recoveryTime: 'acceptable'
      };
    }

    // Extract continuous monitoring results
    const monitoringTest = this.results.tests['Continuous Monitoring'];
    if (monitoringTest && monitoringTest.status === 'passed') {
      const healthScoreMatch = monitoringTest.stdout.match(/Health Score: ([\d.]+)%/);
      if (healthScoreMatch) {
        this.results.performance.continuousMonitoringResults = {
          healthScore: parseFloat(healthScoreMatch[1])
        };
      }
    }
  }

  generateRecommendations() {
    console.log('\n💡 Generating recommendations...');
    
    const recommendations = [];
    
    // Check test results
    if (this.results.summary.failedTests > 0) {
      recommendations.push({
        type: 'critical',
        message: `${this.results.summary.failedTests} test(s) failed. Review failed tests and fix issues before deployment.`,
        priority: 'high'
      });
    }

    // Check deduplication effectiveness
    if (this.results.performance.deduplicationEffectiveness !== null) {
      if (this.results.performance.deduplicationEffectiveness < 70) {
        recommendations.push({
          type: 'performance',
          message: `Deduplication effectiveness is ${this.results.performance.deduplicationEffectiveness}%. Consider optimizing cache configuration.`,
          priority: 'medium'
        });
      } else if (this.results.performance.deduplicationEffectiveness > 90) {
        recommendations.push({
          type: 'success',
          message: `Excellent deduplication effectiveness: ${this.results.performance.deduplicationEffectiveness}%`,
          priority: 'info'
        });
      }
    }

    // Check connection pool performance
    if (this.results.performance.connectionPoolPerformance?.throughput) {
      const throughput = this.results.performance.connectionPoolPerformance.throughput;
      if (throughput < 10) {
        recommendations.push({
          type: 'performance',
          message: `Low throughput detected: ${throughput} req/s. Consider optimizing database connections or scaling.`,
          priority: 'high'
        });
      } else if (throughput > 50) {
        recommendations.push({
          type: 'success',
          message: `Good throughput performance: ${throughput} req/s`,
          priority: 'info'
        });
      }
    }

    // Check health score
    if (this.results.performance.continuousMonitoringResults?.healthScore) {
      const healthScore = this.results.performance.continuousMonitoringResults.healthScore;
      if (healthScore < 80) {
        recommendations.push({
          type: 'critical',
          message: `System health score is ${healthScore}%. Investigate system components immediately.`,
          priority: 'high'
        });
      } else if (healthScore > 95) {
        recommendations.push({
          type: 'success',
          message: `Excellent system health: ${healthScore}%`,
          priority: 'info'
        });
      }
    }

    // Check overall test duration
    const avgTestDuration = this.results.summary.totalDuration / this.results.summary.totalTests;
    if (avgTestDuration > 60000) { // 1 minute average
      recommendations.push({
        type: 'performance',
        message: `Tests are taking longer than expected (avg: ${(avgTestDuration/1000).toFixed(2)}s). Consider optimizing test setup.`,
        priority: 'low'
      });
    }

    this.results.recommendations = recommendations;
  }

  async generateReport() {
    console.log('\n📋 Generating comprehensive report...');
    
    this.results.endTime = new Date().toISOString();
    this.extractPerformanceMetrics();
    this.generateRecommendations();
    
    // Calculate success rate
    const successRate = (this.results.summary.passedTests / this.results.summary.totalTests) * 100;
    
    // Generate summary
    const summary = {
      ...this.results.summary,
      successRate: successRate,
      averageTestDuration: this.results.summary.totalDuration / this.results.summary.totalTests,
      totalDurationFormatted: this.formatDuration(this.results.summary.totalDuration)
    };

    const report = {
      ...this.results,
      summary
    };

    // Save detailed report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `load-test-report-${timestamp}.json`);
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save detailed report:', error.message);
    }

    // Generate summary report
    const summaryReportPath = path.join(__dirname, `load-test-summary-${timestamp}.md`);
    const summaryMarkdown = this.generateMarkdownSummary(report);
    
    try {
      await fs.writeFile(summaryReportPath, summaryMarkdown);
      console.log(`📄 Summary report saved: ${summaryReportPath}`);
    } catch (error) {
      console.error('❌ Failed to save summary report:', error.message);
    }

    return report;
  }

  generateMarkdownSummary(report) {
    const { summary, performance, recommendations } = report;
    
    let markdown = `# API Reliability Load Test Report\n\n`;
    markdown += `**Generated:** ${report.endTime}\n`;
    markdown += `**Duration:** ${summary.totalDurationFormatted}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${summary.totalTests} |\n`;
    markdown += `| Passed | ${summary.passedTests} |\n`;
    markdown += `| Failed | ${summary.failedTests} |\n`;
    markdown += `| Success Rate | ${summary.successRate.toFixed(2)}% |\n`;
    markdown += `| Average Duration | ${(summary.averageTestDuration / 1000).toFixed(2)}s |\n\n`;
    
    markdown += `## Performance Metrics\n\n`;
    
    if (performance.deduplicationEffectiveness !== null) {
      markdown += `- **Deduplication Effectiveness:** ${performance.deduplicationEffectiveness}%\n`;
    }
    
    if (performance.connectionPoolPerformance?.throughput) {
      markdown += `- **Connection Pool Throughput:** ${performance.connectionPoolPerformance.throughput} req/s\n`;
    }
    
    if (performance.continuousMonitoringResults?.healthScore) {
      markdown += `- **System Health Score:** ${performance.continuousMonitoringResults.healthScore}%\n`;
    }
    
    markdown += `\n## Test Results\n\n`;
    
    for (const [testName, testResult] of Object.entries(report.tests)) {
      const status = testResult.status === 'passed' ? '✅' : '❌';
      const duration = (testResult.duration / 1000).toFixed(2);
      markdown += `- ${status} **${testName}** (${duration}s)\n`;
    }
    
    if (recommendations.length > 0) {
      markdown += `\n## Recommendations\n\n`;
      
      const criticalRecs = recommendations.filter(r => r.priority === 'high');
      const mediumRecs = recommendations.filter(r => r.priority === 'medium');
      const infoRecs = recommendations.filter(r => r.priority === 'info');
      
      if (criticalRecs.length > 0) {
        markdown += `### 🚨 Critical Issues\n\n`;
        criticalRecs.forEach(rec => {
          markdown += `- ${rec.message}\n`;
        });
        markdown += `\n`;
      }
      
      if (mediumRecs.length > 0) {
        markdown += `### ⚠️ Performance Improvements\n\n`;
        mediumRecs.forEach(rec => {
          markdown += `- ${rec.message}\n`;
        });
        markdown += `\n`;
      }
      
      if (infoRecs.length > 0) {
        markdown += `### ℹ️ Information\n\n`;
        infoRecs.forEach(rec => {
          markdown += `- ${rec.message}\n`;
        });
      }
    }
    
    return markdown;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async run() {
    console.log('🚀 Starting Comprehensive API Reliability Load Tests');
    console.log('=' .repeat(60));
    
    try {
      // Run Jest-based load tests
      await this.runTest(
        'Concurrent Contacts Load',
        'src/tests/performance/concurrent-contacts-load.test.js',
        600000 // 10 minutes
      );
      
      await this.runTest(
        'Connection Pool Load',
        'src/tests/performance/connection-pool-load.test.js',
        300000 // 5 minutes
      );
      
      await this.runTest(
        'Chaos Engineering',
        'src/tests/performance/chaos-engineering.test.js',
        600000 // 10 minutes
      );
      
      await this.runTest(
        'Continuous Monitoring',
        'src/tests/performance/continuous-reliability-monitoring.test.js',
        300000 // 5 minutes
      );

      // Run Artillery-based load tests
      await this.runArtilleryTest(
        'API Reliability Artillery Load Test',
        'api-reliability-load-test.yml'
      );

      // Generate final report
      const report = await this.generateReport();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 Load Test Suite Completed!');
      console.log('=' .repeat(60));
      console.log(`📊 Total Tests: ${report.summary.totalTests}`);
      console.log(`✅ Passed: ${report.summary.passedTests}`);
      console.log(`❌ Failed: ${report.summary.failedTests}`);
      console.log(`📈 Success Rate: ${report.summary.successRate.toFixed(2)}%`);
      console.log(`⏱️  Total Duration: ${report.summary.totalDurationFormatted}`);
      
      if (report.recommendations.length > 0) {
        console.log(`\n💡 Recommendations: ${report.recommendations.length}`);
        report.recommendations.forEach(rec => {
          const icon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} ${rec.message}`);
        });
      }
      
      // Exit with appropriate code
      process.exit(report.summary.failedTests > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('💥 Load test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new LoadTestRunner();
  runner.run();
}

module.exports = LoadTestRunner;