const db = require('../config/db');

// List all loyalty/credit customers with counts of their total invoices (tenant-isolated)
exports.getAllCustomers = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    const queryStr = `
      SELECT c.*,
             COALESCE(COUNT(o.id), 0) as total_purchases,
             COALESCE(SUM(o.net_amount), 0) as total_spend
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.shop_id = ?
      WHERE c.shop_id = ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    const [customers] = await db.query(queryStr, [shopId, shopId]);
    res.json(customers);
  } catch (error) {
    console.error('Fetch all customers error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Lookup a customer via phone number query (tenant-isolated)
exports.searchCustomer = async (req, res) => {
  const { phone } = req.query;
  const shopId = req.user.shop_id;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number query is required.' });
  }

  try {
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE phone LIKE ? AND shop_id = ? LIMIT 5',
      [`%${phone}%`, shopId]
    );
    res.json(customers);
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Create a new loyalty customer profile (tenant-isolated)
exports.createCustomer = async (req, res) => {
  const { name, phone, email, gst_number, credit_balance } = req.body;
  const shopId = req.user.shop_id;

  if (!name || !phone) {
    return res.status(400).json({ message: 'Customer name and phone number are required.' });
  }

  try {
    // Check duplication inside current tenant shop
    const [existing] = await db.query('SELECT id FROM customers WHERE phone = ? AND shop_id = ?', [phone, shopId]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A customer with this phone number is already registered in your shop.' });
    }

    const [result] = await db.query(
      `INSERT INTO customers (shop_id, name, phone, email, loyalty_points, gst_number, credit_balance) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shopId, name, phone, email || null, 10, gst_number || null, parseFloat(credit_balance) || 0.00]
    );

    res.status(201).json({
      message: 'Customer enrolled successfully.',
      customer: {
        id: result.insertId,
        name,
        phone,
        email,
        loyalty_points: 10,
        gst_number: gst_number || null,
        credit_balance: parseFloat(credit_balance) || 0.00
      }
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Settle customer credit outstanding balance (tenant-isolated)
exports.settleCustomerCredit = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  const shopId = req.user.shop_id;

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ message: 'A valid positive payment amount is required.' });
  }

  const connection = await db.getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [customer] = await connection.query(
      'SELECT credit_balance, loyalty_points, shop_id FROM customers WHERE id = ? FOR UPDATE',
      [id]
    );

    if (customer.length === 0 || customer[0].shop_id !== shopId) {
      await connection.rollback();
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const currentBalance = parseFloat(customer[0].credit_balance);
    const currentPoints = parseInt(customer[0].loyalty_points) || 0;
    
    const newBalance = Math.max(0, currentBalance - paymentAmount);
    
    // Reward customer for settling their credit balance (e.g. 1 loyalty point per 100 paid)
    const pointsEarned = Math.floor(paymentAmount / 100);
    const newPoints = currentPoints + pointsEarned;

    await connection.query(
      'UPDATE customers SET credit_balance = ?, loyalty_points = ? WHERE id = ? AND shop_id = ?',
      [newBalance, newPoints, id, shopId]
    );

    // Log to customer ledger
    await connection.query(
      `INSERT INTO customer_ledger (shop_id, customer_id, type, amount, balance_after, description) 
       VALUES (?, ?, 'Payment', ?, ?, ?)`,
      [shopId, id, paymentAmount, newBalance, `Credit outstanding settled (Paid ₹${paymentAmount.toFixed(2)})`]
    );

    await connection.commit();
    res.json({
      message: 'Customer credit balance settled successfully.',
      newBalance,
      newPoints,
      pointsEarned
    });

  } catch (error) {
    await connection.rollback();
    console.error('Settle customer credit error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Retrieve a single customer's order history log (tenant-isolated)
exports.getCustomerPurchaseHistory = async (req, res) => {
  const { id } = req.params;
  const shopId = req.user.shop_id;

  try {
    const [customer] = await db.query('SELECT name, phone, loyalty_points FROM customers WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (customer.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const [purchases] = await db.query(
      `SELECT id, invoice_number, total_amount, discount, net_amount, payment_method, created_at 
       FROM orders 
       WHERE customer_id = ? AND shop_id = ?
       ORDER BY created_at DESC`,
      [id, shopId]
    );

    res.json({
      customer: customer[0],
      purchases
    });
  } catch (error) {
    console.error('Fetch customer purchases error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Retrieve a customer's detailed running credit ledger (tenant-isolated)
exports.getCustomerLedger = async (req, res) => {
  const { id } = req.params;
  const shopId = req.user.shop_id;

  try {
    const [customer] = await db.query('SELECT * FROM customers WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (customer.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const [ledger] = await db.query(
      'SELECT * FROM customer_ledger WHERE customer_id = ? AND shop_id = ? ORDER BY created_at DESC, id DESC',
      [id, shopId]
    );

    res.json({
      customer: customer[0],
      ledger
    });
  } catch (error) {
    console.error('Fetch customer ledger error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
