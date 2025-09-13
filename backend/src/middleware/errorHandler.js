/**
 * Global error handling middleware for Express
 */

// Custom error classes are defined inline below

/**
 * Error response formatter
 */
const formatErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
    }
  };

  // Add details in development or for validation errors
  if (isDevelopment || error.details) {
    response.error.details = error.details;
  }

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }

  // Add request context in development
  if (isDevelopment) {
    response.error.request = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
    };
  }

  return response;
};

/**
 * Log error for monitoring
 */
const logError = (error, req, res) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    }
  };

  // Log based on severity
  if (res.statusCode >= 500) {
    console.error('Server Error:', logData);
  } else if (res.statusCode >= 400) {
    console.warn('Client Error:', logData);
  } else {
    console.info('Error handled:', logData);
  }

  // In production, you might want to send this to a logging service
  // Example: sendToLoggingService(logData);
};

/**
 * Main error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Set default status code
  let statusCode = error.statusCode || 500;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    error.code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError' || error.message === 'jwt malformed') {
    statusCode = 401;
    error.code = 'UNAUTHORIZED';
    error.message = 'Invalid or expired token';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    error.code = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    error.code = 'NOT_FOUND';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    error.code = 'CONFLICT';
  } else if (error.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    error.code = 'DUPLICATE_ENTRY';
    error.message = 'Resource already exists';
  } else if (error.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    error.code = 'INVALID_REFERENCE';
    error.message = 'Referenced resource does not exist';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    error.code = 'SERVICE_UNAVAILABLE';
    error.message = 'Database connection failed';
  }

  // Set response status
  res.status(statusCode);

  // Log the error
  logError(error, req, res);

  // Format and send error response
  const errorResponse = formatErrorResponse(error, req);
  res.json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} not found`);
  error.statusCode = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
};

/**
 * Async error wrapper to catch async errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error helper
 */
const createValidationError = (message, details = null) => {
  const error = new Error(message);
  error.name = 'ValidationError';
  error.code = 'VALIDATION_ERROR';
  error.statusCode = 400;
  error.details = details;
  return error;
};

/**
 * Not found error helper
 */
const createNotFoundError = (resource = 'Resource') => {
  const error = new Error(`${resource} not found`);
  error.name = 'NotFoundError';
  error.code = 'NOT_FOUND';
  error.statusCode = 404;
  return error;
};

/**
 * Conflict error helper
 */
const createConflictError = (message, details = null) => {
  const error = new Error(message);
  error.name = 'ConflictError';
  error.code = 'CONFLICT';
  error.statusCode = 409;
  error.details = details;
  return error;
};

/**
 * Unauthorized error helper
 */
const createUnauthorizedError = (message = 'Unauthorized') => {
  const error = new Error(message);
  error.name = 'UnauthorizedError';
  error.code = 'UNAUTHORIZED';
  error.statusCode = 401;
  return error;
};

/**
 * Forbidden error helper
 */
const createForbiddenError = (message = 'Forbidden') => {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  error.code = 'FORBIDDEN';
  error.statusCode = 403;
  return error;
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createValidationError,
  createNotFoundError,
  createConflictError,
  createUnauthorizedError,
  createForbiddenError,
};