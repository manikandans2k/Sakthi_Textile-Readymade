const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/security');
const { 
  handleValidationErrors, 
  loginRules, 
  registerRules, 
  forgotRules, 
  resetRules 
} = require('../middleware/validation');

// Public Authentication endpoints with strict rate limiting and schema validations
router.post(
  '/login', 
  authRateLimiter, 
  loginRules, 
  handleValidationErrors, 
  authController.login
);

router.post(
  '/forgot-password', 
  authRateLimiter, 
  forgotRules, 
  handleValidationErrors, 
  authController.forgotPassword
);

router.post(
  '/reset-password', 
  authRateLimiter, 
  resetRules, 
  handleValidationErrors, 
  authController.resetPassword
);

router.post(
  '/refresh-token', 
  authController.refreshToken
);

// Protected endpoints requiring a valid access token
router.get(
  '/me', 
  authenticateToken, 
  authController.getMe
);

router.post(
  '/logout', 
  authenticateToken, 
  authController.logout
);

// Restrict registration to Admin and Manager roles only
router.post(
  '/register', 
  authenticateToken, 
  requireRoles('Shop Owner', 'Admin', 'Manager'), 
  registerRules, 
  handleValidationErrors, 
  authController.register
);

module.exports = router;
