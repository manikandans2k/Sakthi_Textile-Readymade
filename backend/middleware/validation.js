const { body, validationResult } = require('express-validator');

/**
 * Middleware that intercepts validation results and returns unified, 
 * sanitized Bad Request (400) payloads on format mismatches.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Input validation failed. Parameters contain illegal formats.',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }
  next();
};

// ========================================================
// AUTHENTICATION SCHEMAS
// ========================================================

const loginRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters.')
    .escape(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 5 }).withMessage('Password must be at least 5 characters long.')
];

const registerRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .isAlphanumeric().withMessage('Username must contain only alphanumeric characters.')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters.')
    .escape(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
    .matches(/^\S+$/).withMessage('Password cannot contain spaces.'),
  body('role')
    .notEmpty().withMessage('User role is required.')
    .isIn(['Admin', 'Manager', 'Cashier', 'Stock Manager']).withMessage('Role must be one of: Admin, Manager, Cashier, Stock Manager.')
];

const forgotRules = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required.')
    .escape()
];

const resetRules = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required.')
    .isHexadecimal().withMessage('Invalid reset token encoding.')
    .isLength({ min: 40, max: 40 }).withMessage('Reset token must be exactly 40 characters.'),
  body('password')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
    .matches(/^\S+$/).withMessage('Password cannot contain spaces.')
];

module.exports = {
  handleValidationErrors,
  loginRules,
  registerRules,
  forgotRules,
  resetRules
};
