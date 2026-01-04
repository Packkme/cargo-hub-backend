const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const AppError = require('../utils/AppError');

// Rate limiting configuration
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
    message: {
      success: false,
      status: 'error',
      error: {
        message: 'Too many requests from this IP, please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      throw new AppError(
        'Too many requests from this IP, please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED'
      );
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

// Specific rate limiters
const generalLimiter = createRateLimiter();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    success: false,
    status: 'error',
    error: {
      message: 'Too many login attempts from this IP, please try again after 15 minutes.',
      errorCode: 'LOGIN_RATE_LIMIT_EXCEEDED'
    }
  }
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Higher limit for authenticated API calls
});

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Basic XSS protection - remove script tags
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        obj[key] = sanitize(obj[key]);
      });
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

// CORS validation middleware
const validateCORS = (req, res, next) => {
  const origin = req.get('Origin');

  // Must match the same origins you allow in express.js
  const allowedOrigins = (process.env.ALLOWED_ORIGINS).split(',');

  // Allow requests with no Origin
  if (!origin) return next();

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  return next(new AppError('CORS policy violation', 403, 'CORS_VIOLATION'));
};


module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  helmetConfig,
  sanitizeInput,
  validateCORS,
  createRateLimiter
};
