// Error types and codes
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

// User-friendly error messages
export const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK]: 'Unable to connect to the server. Please check your internet connection.',
  [ERROR_TYPES.VALIDATION]: 'Please check your input and try again.',
  [ERROR_TYPES.AUTHENTICATION]: 'Invalid credentials. Please check your username and password.',
  [ERROR_TYPES.AUTHORIZATION]: 'You don\'t have permission to perform this action.',
  [ERROR_TYPES.NOT_FOUND]: 'The requested resource was not found.',
  [ERROR_TYPES.SERVER]: 'Something went wrong on our end. Please try again later.',
  [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Please try again.'
};

// Map HTTP status codes to error types
export const getErrorType = (status, code) => {
  if (!status) return ERROR_TYPES.NETWORK;
  
  if (code) {
    switch (code) {
      case 'VALIDATION_ERROR':
        return ERROR_TYPES.VALIDATION;
      case 'AUTHENTICATION_ERROR':
        return ERROR_TYPES.AUTHENTICATION;
      case 'AUTHORIZATION_ERROR':
        return ERROR_TYPES.AUTHORIZATION;
      default:
        break;
    }
  }

  switch (status) {
    case 400:
      return ERROR_TYPES.VALIDATION;
    case 401:
      return ERROR_TYPES.AUTHENTICATION;
    case 403:
      return ERROR_TYPES.AUTHORIZATION;
    case 404:
      return ERROR_TYPES.NOT_FOUND;
    case 500:
    case 502:
    case 503:
    case 504:
      return ERROR_TYPES.SERVER;
    default:
      return ERROR_TYPES.UNKNOWN;
  }
};

// Format error for display
export const formatError = (error) => {
  if (!error) return { type: ERROR_TYPES.UNKNOWN, message: ERROR_MESSAGES[ERROR_TYPES.UNKNOWN] };

  // Handle network errors
  if (error.code === 'NETWORK_ERROR' || !error.response) {
    return {
      type: ERROR_TYPES.NETWORK,
      message: ERROR_MESSAGES[ERROR_TYPES.NETWORK]
    };
  }

  const { status, data } = error.response || {};
  const errorCode = data?.error?.code;
  const errorMessage = data?.error?.message;
  const errorType = getErrorType(status, errorCode);

  return {
    type: errorType,
    message: errorMessage || ERROR_MESSAGES[errorType],
    details: data?.error?.details,
    status
  };
};

// Create user-friendly error object
export const createError = (type, message, details = null) => ({
  type,
  message: message || ERROR_MESSAGES[type],
  details,
  timestamp: new Date().toISOString()
});

// Log error for debugging
export const logError = (error, context = '') => {
  const errorInfo = {
    error: error.message || error,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };

  console.error('Application Error:', errorInfo);

  // In production, you might want to send this to an error tracking service
  if (process.env.NODE_ENV === 'production') {
    // sendToErrorTrackingService(errorInfo);
  }
};

// Retry mechanism for failed requests
export const createRetryHandler = (maxRetries = 3, delay = 1000) => {
  return async (fn, ...args) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx) except 408 (timeout)
        if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 408) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  };
};