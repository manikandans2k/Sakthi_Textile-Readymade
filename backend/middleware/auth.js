const jwt = require('jsonwebtoken');
const { logSecurityEvent } = require('../utils/auditLogger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 64
  ? process.env.JWT_SECRET
  : (process.env.NODE_ENV === 'production' 
      ? (() => { throw new Error('CRITICAL CONFIGURATION ERROR: process.env.JWT_SECRET must be set in production with at least 64 characters!'); })()
      : 'super_secret_textile_pos_key_2026_default_development_key_minimum_64_characters_long_string_for_testing');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Token missing.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalid or expired.' });
    }
    req.user = user;
    next();
  });
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized access attempts to the security audit logs
      logSecurityEvent(
        req.user.id,
        'UNAUTHORIZED_ACCESS_BLOCKED',
        req,
        `Attempted Route: "${req.originalUrl}" (method: ${req.method}). Required roles: [${allowedRoles.join(', ')}]. Current role: "${req.user.role}".`
      );

      return res.status(403).json({ 
        message: 'Forbidden. You do not have permissions to access this endpoint.' 
      });
    }
    
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRoles
};
