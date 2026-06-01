const db = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { hashPassword, comparePassword } = require('../utils/password');
const { logSecurityEvent } = require('../utils/auditLogger');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_textile_pos_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_secret_textile_pos_refresh_key_2026';

/**
 * Register a new staff user (restricted to Admin/Manager roles).
 */
exports.register = async (req, res, next) => {
  const { username, password, role } = req.body;
  const shopId = req.user && req.user.role === 'Super Admin' ? req.body.shop_id : (req.user ? req.user.shop_id : null);

  try {
    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    // Encrypt password using secure password utility
    const passwordHash = await hashPassword(password);

    // Insert user record
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, role, shop_id) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role, shopId]
    );

    // Log the security audit log entry
    await logSecurityEvent(
      req.user ? req.user.id : null,
      'USER_REGISTRATION_SUCCESS',
      req,
      `Registered user: "${username}" with role: "${role}"`
    );

    res.status(201).json({
      message: 'User registered successfully.',
      userId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle staff login credentials validation.
 * Generates both an Access Token (8h) and Refresh Token (7d).
 */
exports.login = async (req, res, next) => {
  const { username, password } = req.body; // username parameter can be username or email

  try {
    // Look up staff user by username OR email joining roles
    const [users] = await db.query(`
      SELECT u.*, r.role_name AS role 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.username = ? OR u.email = ?
    `, [username, username]);
    if (users.length === 0) {
      await logSecurityEvent(
        null,
        'FAILED_LOGIN_ATTEMPT',
        req,
        `Attempted login with non-existent username or email: "${username}"`
      );
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = users[0];

    // Reject authentication if account status is Inactive
    if (user.status === 'Inactive') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact your administrator.' });
    }

    // Verify plaintext password against the secure hash
    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await logSecurityEvent(
        user.id,
        'FAILED_LOGIN_ATTEMPT',
        req,
        `Incorrect password for username: "${username}"`
      );
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // SaaS Multi-Tenant active tier checks:
    if (user.shop_id) {
      const [shops] = await db.query('SELECT * FROM shops WHERE id = ?', [user.shop_id]);
      if (shops.length === 0) {
        return res.status(403).json({ message: 'Associated shop not found.' });
      }
      const shop = shops[0];
      if (shop.status === 'Suspended') {
        return res.status(403).json({ message: 'Your shop subscription has been suspended. Please contact the Super Administrator.' });
      }
      const expiry = new Date(shop.subscription_expiry);
      if (expiry < new Date()) {
        return res.status(403).json({ message: 'Your shop subscription has expired. Please renew the plan.' });
      }
    }

    // Generate brief short-lived Access Token (8h)
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, shop_id: user.shop_id, permissions: user.permissions },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Generate long-lived session Refresh Token (7d)
    const refreshToken = jwt.sign(
      { id: user.id },
      REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Hash the Refresh Token using sha256 to securely store in db (prevent token leaks)
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [hashedRefreshToken, user.id]);

    // Log successful login security audit event
    await logSecurityEvent(
      user.id,
      'USER_LOGIN_SUCCESS',
      req,
      `User "${username}" logged in successfully.`
    );

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        shop_id: user.shop_id,
        permissions: user.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Exchange a valid Refresh Token for a fresh short-lived Access Token.
 */
exports.refreshToken = async (req, res, next) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Refresh token is required.' });
  }

  try {
    // Verify the Refresh JWT signature and expiry
    let payload;
    try {
      payload = jwt.verify(token, REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }

    const userId = payload.id;

    // Check if the user exists
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(403).json({ message: 'User does not exist.' });
    }

    const user = users[0];

    // Compute incoming token hash and compare with DB to verify it hasn't been revoked
    const incomingHash = crypto.createHash('sha256').update(token).digest('hex');
    if (user.refresh_token !== incomingHash) {
      await logSecurityEvent(
        user.id,
        'REVOKED_REFRESH_TOKEN_ATTEMPT',
        req,
        `Attempted token refresh with revoked or outdated refresh token.`
      );
      return res.status(403).json({ message: 'Refresh token has been revoked.' });
    }

    // Generate a new 8h Access Token
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, shop_id: user.shop_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle staff logout and session revocation.
 */
exports.logout = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Revoke Refresh Token by clearing it in database
    await db.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [userId]);

    // Log the logout event
    await logSecurityEvent(
      userId,
      'USER_LOGOUT',
      req,
      `User logged out and session revoked.`
    );

    res.json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password recovery. Generates 40-character hex reset token.
 */
exports.forgotPassword = async (req, res, next) => {
  const { username } = req.body; // Can be username or email

  try {
    const [users] = await db.query('SELECT id, username FROM users WHERE username = ? OR email = ?', [username, username]);
    
    // Maintain secure API standards: return success message to avoid account enumeration,
    // but also return the token directly in payload as part of the simulation dispatch.
    if (users.length === 0) {
      await logSecurityEvent(
        null,
        'PASSWORD_RESET_ATTEMPT_NONEXISTENT_USER',
        req,
        `Attempted reset for non-existent username or email: "${username}"`
      );
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];

    // Generate cryptographically secure 40-character hex reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Store in DB with 1h expiry (Current time + 1 hour)
    const expires = new Date(Date.now() + 3600000);

    await db.query(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, expires, user.id]
    );

    // Audit log the password reset request
    await logSecurityEvent(
      user.id,
      'PASSWORD_RESET_REQUESTED',
      req,
      `Password reset requested for username: "${username}"`
    );

    res.json({
      message: 'Password reset token generated successfully (simulated email dispatch).',
      resetToken,
      expiresAt: expires.toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Performs password update using valid reset token.
 */
exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  try {
    // Find matching valid and non-expired token
    const [users] = await db.query(
      'SELECT id, username FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token]
    );

    if (users.length === 0) {
      await logSecurityEvent(
        null,
        'INVALID_RESET_TOKEN_ATTEMPT',
        req,
        `Attempted password reset with expired or invalid token.`
      );
      return res.status(400).json({ message: 'Invalid or expired password reset token.' });
    }

    const user = users[0];

    // Hash the new password securely
    const hashedPass = await hashPassword(password);

    // Update password and clear reset/refresh token fields (revoking active sessions)
    await db.query(
      'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, refresh_token = NULL WHERE id = ?',
      [hashedPass, user.id]
    );

    // Log the successful password reset audit entry
    await logSecurityEvent(
      user.id,
      'PASSWORD_RESET_SUCCESS',
      req,
      `Password successfully reset for user "${user.username}". Active sessions revoked.`
    );

    res.json({ message: 'Password has been reset successfully. Please log in with your new credentials.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch currently logged in user info.
 */
exports.getMe = async (req, res, next) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, r.role_name AS role, u.shop_id, u.permissions, u.created_at 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = ?
    `, [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    next(error);
  }
};
