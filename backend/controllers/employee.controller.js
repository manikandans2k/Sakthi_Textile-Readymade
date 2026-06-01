const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { logSecurityEvent } = require('../utils/auditLogger');

/**
 * Get all employees of the current shop (restricted to Shop Owner and Super Admin).
 */
exports.getAllEmployees = async (req, res, next) => {
  const shopId = req.user.shop_id;

  try {
    if (!shopId) {
      return res.status(400).json({ message: 'User is not associated with any shop.' });
    }

    const [employees] = await db.query(`
      SELECT u.id, u.username, u.shop_id, u.created_by, u.status, u.permissions, u.created_at,
             r.id AS role_id, r.role_name AS role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.shop_id = ? AND r.role_name IN ('Manager', 'Cashier', 'Stock Manager')
      ORDER BY u.created_at DESC
    `, [shopId]);

    res.json(employees);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new employee under the current shop's scope.
 */
exports.createEmployee = async (req, res, next) => {
  const shopId = req.user.shop_id;
  const createdBy = req.user.id;
  const { username, password, role_id, permissions } = req.body;

  if (!username || !password || !role_id) {
    return res.status(400).json({ message: 'Username, password, and role are required.' });
  }

  try {
    if (!shopId) {
      return res.status(400).json({ message: 'User is not associated with any shop.' });
    }

    // Verify username uniqueness globally (users table has unique username constraint)
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    // Validate the target role
    const [roles] = await db.query('SELECT role_name FROM roles WHERE id = ?', [role_id]);
    if (roles.length === 0) {
      return res.status(400).json({ message: 'Selected role does not exist.' });
    }

    const roleName = roles[0].role_name;
    if (!['Manager', 'Cashier', 'Stock Manager'].includes(roleName)) {
      return res.status(403).json({ message: 'Unauthorized. You cannot create users with this role.' });
    }

    // Hash password securely
    const passwordHash = await hashPassword(password);

    // Save comma-separated custom permissions (or defaults if not specified)
    let permissionsString = permissions;
    if (!permissionsString) {
      if (roleName === 'Manager') permissionsString = 'billing,products,inventory,reports';
      else if (roleName === 'Cashier') permissionsString = 'billing';
      else if (roleName === 'Stock Manager') permissionsString = 'inventory';
    }

    const [result] = await db.query(`
      INSERT INTO users (username, password_hash, role_id, shop_id, created_by, status, permissions)
      VALUES (?, ?, ?, ?, ?, 'Active', ?)
    `, [username, passwordHash, role_id, shopId, createdBy, permissionsString]);

    await logSecurityEvent(
      createdBy,
      'USER_REGISTRATION_SUCCESS',
      req,
      `Shop Owner registered new employee: "${username}" with role: "${roleName}" (Shop ID: ${shopId})`
    );

    res.status(201).json({
      message: 'Employee registered successfully.',
      employeeId: result.insertId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an employee's details (role, status, and permissions).
 */
exports.updateEmployee = async (req, res, next) => {
  const shopId = req.user.shop_id;
  const { id } = req.params; // employee user id
  const { role_id, status, permissions } = req.body;

  try {
    if (!shopId) {
      return res.status(400).json({ message: 'User is not associated with any shop.' });
    }

    // Verify employee exists and belongs to the same shop
    const [employees] = await db.query('SELECT * FROM users WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (employees.length === 0) {
      return res.status(404).json({ message: 'Employee not found in your shop.' });
    }

    // Validate role
    if (role_id) {
      const [roles] = await db.query('SELECT role_name FROM roles WHERE id = ?', [role_id]);
      if (roles.length === 0) {
        return res.status(400).json({ message: 'Selected role does not exist.' });
      }
      const roleName = roles[0].role_name;
      if (!['Manager', 'Cashier', 'Stock Manager'].includes(roleName)) {
        return res.status(403).json({ message: 'Unauthorized. Selected role is invalid for staff members.' });
      }
    }

    // Validate status
    if (status && !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "Active" or "Inactive".' });
    }

    // Build update parameters
    const updateFields = [];
    const updateValues = [];

    if (role_id) {
      updateFields.push('role_id = ?');
      updateValues.push(role_id);
    }
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (permissions !== undefined) {
      updateFields.push('permissions = ?');
      updateValues.push(permissions);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid update parameters provided.' });
    }

    updateValues.push(id, shopId);
    await db.query(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND shop_id = ?
    `, updateValues);

    // If deactivating user or updating role, revoke active refresh tokens so they must re-authenticate
    if (status === 'Inactive') {
      await db.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [id]);
    }

    await logSecurityEvent(
      req.user.id,
      'USER_UPDATE_SUCCESS',
      req,
      `Updated employee parameters (User ID: ${id}, Shop ID: ${shopId})`
    );

    res.json({ message: 'Employee parameters updated successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset employee's password directly by the Shop Owner.
 */
exports.resetEmployeePassword = async (req, res, next) => {
  const shopId = req.user.shop_id;
  const { id } = req.params; // employee user id
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'A valid password of at least 6 characters is required.' });
  }

  try {
    if (!shopId) {
      return res.status(400).json({ message: 'User is not associated with any shop.' });
    }

    // Verify employee exists and belongs to the same shop
    const [employees] = await db.query('SELECT username FROM users WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (employees.length === 0) {
      return res.status(404).json({ message: 'Employee not found in your shop.' });
    }

    const employee = employees[0];
    const passwordHash = await hashPassword(password);

    // Update password and clear refresh token (forcing log out)
    await db.query('UPDATE users SET password_hash = ?, refresh_token = NULL WHERE id = ? AND shop_id = ?', [passwordHash, id, shopId]);

    await logSecurityEvent(
      req.user.id,
      'PASSWORD_RESET_SUCCESS',
      req,
      `Shop Owner reset password for employee: "${employee.username}" (Shop ID: ${shopId}). Active sessions revoked.`
    );

    res.json({ message: `Password for "${employee.username}" has been reset successfully. Active sessions revoked.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available staff roles.
 */
exports.getStaffRoles = async (req, res, next) => {
  try {
    const [roles] = await db.query(`
      SELECT id, role_name
      FROM roles
      WHERE role_name IN ('Manager', 'Cashier', 'Stock Manager')
      ORDER BY id ASC
    `);
    res.json(roles);
  } catch (error) {
    next(error);
  }
};
