const db = require('../config/db');
const { hashPassword } = require('../utils/password');

/**
 * Fetch overall SaaS aggregate metrics across all shops
 */
exports.getSaasDashboard = async (req, res, next) => {
  try {
    // 1. Core KPIs
    const [shopsCount] = await db.query('SELECT COUNT(*) as count FROM shops');
    const [activeShops] = await db.query("SELECT COUNT(*) as count FROM shops WHERE status = 'Active' AND (subscription_expiry > NOW() OR subscription_expiry IS NULL)");
    const [suspendedShops] = await db.query("SELECT COUNT(*) as count FROM shops WHERE status = 'Suspended' OR (subscription_expiry <= NOW())");
    
    const [totalRevenue] = await db.query('SELECT COALESCE(SUM(net_amount), 0) as amount FROM orders');
    const [totalOrders] = await db.query('SELECT COUNT(*) as count FROM orders');
    const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');

    // 2. Recent shops registered
    const [recentShops] = await db.query(`
      SELECT id, shop_name, owner_name, email, subscription_plan, subscription_expiry, status, created_at
      FROM shops
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 3. Shop list distribution by subscription plan
    const [planDistribution] = await db.query(`
      SELECT subscription_plan as plan, COUNT(*) as count
      FROM shops
      GROUP BY subscription_plan
    `);

    res.json({
      metrics: {
        totalShops: shopsCount[0].count,
        activeShops: activeShops[0].count,
        suspendedShops: suspendedShops[0].count,
        totalRevenue: parseFloat(totalRevenue[0].amount),
        totalOrders: totalOrders[0].count,
        totalUsers: totalUsers[0].count
      },
      recentShops,
      planDistribution
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve list of all shops with detailed info
 */
exports.getShops = async (req, res, next) => {
  try {
    const [shops] = await db.query(`
      SELECT s.*, 
             COALESCE(u.username, 'N/A') as owner_username,
             u.id as owner_user_id,
             COALESCE((SELECT COUNT(*) FROM product_variants pv WHERE pv.shop_id = s.id), 0) as total_products,
             COALESCE((SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id), 0) as total_orders
      FROM shops s
      LEFT JOIN users u ON s.id = u.shop_id AND u.role_id = (SELECT id FROM roles WHERE role_name = 'Shop Owner')
      ORDER BY s.created_at DESC
    `);
    res.json(shops);
  } catch (error) {
    next(error);
  }
};

/**
 * Atomic transaction to create a shop and associate an owner account
 */
exports.createShop = async (req, res, next) => {
  const {
    shop_name,
    owner_name,
    mobile,
    email,
    gst_number,
    address,
    subscription_plan,
    subscription_expiry,
    username,
    password,
    gst_enabled
  } = req.body;

  if (!shop_name || !owner_name || !mobile || !email || !username || !password) {
    return res.status(400).json({ message: 'Shop name, owner name, mobile, email, username, and password are required.' });
  }

  // Validate plan and expiry
  const plan = subscription_plan || 'Starter';
  const expiry = subscription_expiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // Default 30 days

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify email unique in shops
    const [existingShop] = await connection.query('SELECT id FROM shops WHERE email = ?', [email]);
    if (existingShop.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'A shop with this email address already exists.' });
    }

    // 2. Verify username unique in users
    const [existingUser] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Username is already taken by another store owner/employee.' });
    }

    // 3. Create Shop
    const gstVal = gst_enabled !== false && gst_enabled !== 0 && gst_enabled !== 'false' ? 1 : 0;
    const [shopResult] = await connection.query(`
      INSERT INTO shops (shop_name, owner_name, mobile, email, gst_number, address, subscription_plan, subscription_expiry, status, gst_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `, [shop_name, owner_name, mobile, email, gst_number || null, address || null, plan, expiry, gstVal]);

    const shopId = shopResult.insertId;

    // 4. Create Owner User
    const passwordHash = await hashPassword(password);
    await connection.query(`
      INSERT INTO users (username, password_hash, role_id, shop_id, status, permissions)
      VALUES (?, ?, (SELECT id FROM roles WHERE role_name = 'Shop Owner'), ?, 'Active', 'billing,products,inventory,reports')
    `, [username, passwordHash, shopId]);

    // 5. Seed default Warehouse
    await connection.query(`
      INSERT INTO warehouses (shop_id, name, location, capacity)
      VALUES (?, 'Main Warehouse', 'Default Central Depot', 10000)
    `, [shopId]);

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: 'Tenant shop and owner account created successfully.',
      shopId,
      shop_name,
      owner_name
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
};

/**
 * Suspend or Activate shop plan access
 */
exports.updateShopStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Active', 'Suspended'].includes(status)) {
    return res.status(400).json({ message: 'Valid status ("Active" or "Suspended") is required.' });
  }

  try {
    const [result] = await db.query('UPDATE shops SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Shop not found.' });
    }

    res.json({ message: `Shop subscription status updated to ${status} successfully.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Change subscription tiers and extend expiry dates
 */
exports.updateShopSubscription = async (req, res, next) => {
  const { id } = req.params;
  const { subscription_plan, subscription_expiry } = req.body;

  if (!subscription_plan || !subscription_expiry) {
    return res.status(400).json({ message: 'Subscription plan tier and expiry timestamp are required.' });
  }

  try {
    const formattedExpiry = new Date(subscription_expiry).toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await db.query(`
      UPDATE shops 
      SET subscription_plan = ?, subscription_expiry = ? 
      WHERE id = ?
    `, [subscription_plan, formattedExpiry, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Shop not found.' });
    }

    res.json({ message: 'Shop subscription updated successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset staff passwords directly by Super Admin
 */
exports.resetShopOwnerPassword = async (req, res, next) => {
  const { id } = req.params; // user_id
  const { password } = req.body;

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'A valid password of at least 6 characters is required.' });
  }

  try {
    // Make sure we are resetting a tenant user, not another super admin
    const [users] = await db.query('SELECT u.username, r.role_name AS role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = users[0];
    if (user.role === 'Super Admin') {
      return res.status(403).json({ message: 'Unauthorized. Super Admin passwords cannot be reset from this panel.' });
    }

    const passwordHash = await hashPassword(password);
    await db.query('UPDATE users SET password_hash = ?, refresh_token = NULL WHERE id = ?', [passwordHash, id]);

    res.json({ message: `Password for "${user.username}" reset successfully. Active sessions revoked.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Update comprehensive shop details and associated owner account parameters (username, email, password, plan, etc.)
 */
exports.updateShopDetails = async (req, res, next) => {
  const { id } = req.params; // shop_id
  const {
    shop_name,
    owner_name,
    mobile,
    email,
    gst_number,
    address,
    subscription_plan,
    subscription_expiry,
    gst_enabled,
    username,
    password
  } = req.body;

  if (!shop_name || !owner_name || !mobile || !email || !username) {
    return res.status(400).json({ message: 'Shop name, owner name, mobile, email, and username are required.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify email unique in shops (excluding current shop)
    const [existingShop] = await connection.query('SELECT id FROM shops WHERE email = ? AND id != ?', [email, id]);
    if (existingShop.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Another shop is already registered with this email address.' });
    }

    // 2. Verify username unique in users (excluding current shop owner user)
    const [ownerRows] = await connection.query(
      "SELECT id FROM users WHERE shop_id = ? AND role_id = (SELECT id FROM roles WHERE role_name = 'Shop Owner')",
      [id]
    );

    let ownerUserId = null;
    if (ownerRows.length > 0) {
      ownerUserId = ownerRows[0].id;
      const [existingUser] = await connection.query('SELECT id FROM users WHERE username = ? AND id != ?', [username, ownerUserId]);
      if (existingUser.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'Username is already taken by another store owner or staff member.' });
      }
    }

    // 3. Update Shop details
    const gstVal = gst_enabled !== false && gst_enabled !== 0 && gst_enabled !== 'false' ? 1 : 0;
    const formattedExpiry = subscription_expiry ? new Date(subscription_expiry).toISOString().slice(0, 19).replace('T', ' ') : null;

    await connection.query(`
      UPDATE shops 
      SET shop_name = ?, owner_name = ?, mobile = ?, email = ?, gst_number = ?, address = ?, subscription_plan = ?, subscription_expiry = ?, gst_enabled = ?
      WHERE id = ?
    `, [shop_name, owner_name, mobile, email, gst_number || null, address || null, subscription_plan, formattedExpiry, gstVal, id]);

    // 4. Update Owner User credentials
    if (ownerUserId) {
      if (password && password.length >= 6) {
        const passwordHash = await hashPassword(password);
        await connection.query(`
          UPDATE users 
          SET username = ?, email = ?, password_hash = ?, refresh_token = NULL 
          WHERE id = ?
        `, [username, email, passwordHash, ownerUserId]);
      } else {
        await connection.query(`
          UPDATE users 
          SET username = ?, email = ? 
          WHERE id = ?
        `, [username, email, ownerUserId]);
      }
    } else {
      // Owner doesn't exist? Create one! (Edge case)
      const roleIdResult = await connection.query("SELECT id FROM roles WHERE role_name = 'Shop Owner'");
      const roleId = roleIdResult[0][0].id;
      const passVal = password && password.length >= 6 ? password : 'owner123';
      const passwordHash = await hashPassword(passVal);
      await connection.query(`
        INSERT INTO users (username, email, password_hash, role_id, shop_id, status, permissions)
        VALUES (?, ?, ?, ?, ?, 'Active', 'billing,products,inventory,reports')
      `, [username, email, passwordHash, roleId, id]);
    }

    await connection.commit();
    connection.release();

    res.json({ message: 'Shop details and owner account parameters updated successfully.' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    next(error);
  }
};

