const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

/**
 * Configure logging middleware
 */
function configureLogging() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  if (isProduction) {
    // Production: Log to file with combined format
    const accessLogStream = fs.createWriteStream(
      path.join(logsDir, 'access.log'),
      { flags: 'a' }
    );

    return morgan('combined', { 
      stream: accessLogStream,
      skip: (req, res) => {
        // Skip logging health checks in production
        return req.path === '/health' || req.path === '/health/db';
      }
    });
  } else {
    // Development: Log to console with dev format
    return morgan('dev');
  }
}

/**
 * Configure error logging
 */
function logError(error, req = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: req ? {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip
    } : null
  };

  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Log to file in production
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const errorLogPath = path.join(logsDir, 'error.log');
    fs.appendFileSync(errorLogPath, JSON.stringify(logEntry) + '\n');
  } else {
    // Log to console in development
    console.error('Error:', logEntry);
  }
}

module.exports = {
  configureLogging,
  logError
};