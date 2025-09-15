const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

/**
 * Configure CORS middleware based on environment
 */
function configureCors() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: isProduction ? 86400 : 0 // 24 hours in production, 0 in development
  };

  return cors(corsOptions);
}

/**
 * Configure rate limiting middleware
 */
function configureRateLimit() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isDevelopment ? 60 * 1000 : 15 * 60 * 1000); // 1 minute in dev, 15 minutes in prod
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDevelopment ? 1000 : 100); // 1000 in dev, 100 in prod

  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for health checks and in development for certain paths
    skip: (req) => {
      if (req.path === '/health' || req.path === '/health/db') return true;
      // In development, be more lenient with rate limiting
      if (isDevelopment && (req.path.startsWith('/api/friend-requests') || req.path.startsWith('/api/contacts'))) {
        return false; // Still apply rate limiting but with higher limits
      }
      return false;
    }
  });
}

/**
 * Configure authentication rate limiting (stricter)
 */
function configureAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Increased limit for testing - Limit each IP to 20 requests per windowMs for auth endpoints
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 900 // 15 minutes
    },
    standardHeaders: true,
    legacyHeaders: false
  });
}

/**
 * Configure Helmet security middleware
 */
function configureHelmet() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for Socket.IO compatibility
    hsts: {
      maxAge: isProduction ? 31536000 : 0, // 1 year in production
      includeSubDomains: isProduction,
      preload: isProduction
    }
  });
}

/**
 * Configure trust proxy settings
 */
function configureTrustProxy(app) {
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
}

module.exports = {
  configureCors,
  configureRateLimit,
  configureAuthRateLimit,
  configureHelmet,
  configureTrustProxy
};