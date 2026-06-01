const rateLimit = require('express-rate-limit');

// ========================================================
// 1. RATE LIMITING MIDDLEWARES
// ========================================================

// Standard API rate limiter to protect overall database load
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    message: 'Too many requests from this client. Access restricted temporarily.'
  }
});

// Strict authentication limiter to defend against brute force credential stuffing
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication/reset operations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication or recovery attempts. Rate limit exceeded. Try again in 15 minutes.'
  }
});

// ========================================================
// 2. RECURSIVE XSS payload SANITIZATION
// ========================================================

/**
 * Deep recursive string sanitizer that strips HTML tags and cleans parameters.
 */
function cleanXss(val) {
  if (typeof val === 'string') {
    // Strip HTML tags completely using regex
    return val.replace(/<[^>]*>/g, '').trim();
  }
  if (Array.isArray(val)) {
    return val.map(cleanXss);
  }
  if (typeof val === 'object' && val !== null) {
    const cleanedObj = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        cleanedObj[key] = cleanXss(val[key]);
      }
    }
    return cleanedObj;
  }
  return val;
}

/**
 * Express middleware to sanitise all incoming body, query, and params fields.
 */
function xssPayloadSanitizer(req, res, next) {
  req.body = cleanXss(req.body);
  req.query = cleanXss(req.query);
  req.params = cleanXss(req.params);
  next();
}

// ========================================================
// 3. SECURE CENTRALIZED ERROR HANDLER
// ========================================================

/**
 * Production-ready centralized error handler.
 * Strips technical stack traces in production to prevent path/database disclosure.
 */
function secureErrorHandler(err, req, res, next) {
  // Log detailed error stack traces on node console for diagnostic review
  console.error('==================================================');
  console.error('SECURITY ALERT: Unhandled Server Exception!');
  console.error('Timestamp:', new Date().toISOString());
  console.error('Path:', req.originalUrl);
  console.error('IP Address:', req.ip);
  console.error('Stack Trace:', err.stack || err.message || err);
  console.error('==================================================');

  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(status).json({
    message: status === 500 
      ? 'An unexpected error occurred. Please contact the POS system administrator.' 
      : err.message,
    // Provide stack trace context only during local developments
    ...(isProduction ? {} : { stack: err.stack, details: err.message })
  });
}

module.exports = {
  generalApiLimiter,
  authRateLimiter,
  xssPayloadSanitizer,
  secureErrorHandler
};
