const db = require('../config/db');

// List all suppliers with outstanding credit balances (tenant-isolated)
exports.getAllSuppliers = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    const queryStr = `
      SELECT s.*,
             COALESCE(COUNT(sl.id), 0) as ledger_entries_count
      FROM suppliers s
      LEFT JOIN supplier_ledger sl ON s.id = sl.supplier_id AND sl.shop_id = ?
      WHERE s.shop_id = ?
      GROUP BY s.id
      ORDER BY s.name ASC
    `;
    const [suppliers] = await db.query(queryStr, [shopId, shopId]);
    res.json(suppliers);
  } catch (error) {
    console.error('Fetch suppliers error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Create a new supplier
exports.createSupplier = async (req, res) => {
  const { name, contact_person, phone, email, gstin, credit_balance } = req.body;
  const shopId = req.user.shop_id;

  if (!name || !contact_person || !phone) {
    return res.status(400).json({ message: 'Supplier name, contact person, and phone are required.' });
  }

  const initialCredit = parseFloat(credit_balance) || 0.00;
  const connection = await db.getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO suppliers (shop_id, name, contact_person, phone, email, gstin, credit_balance) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shopId, name, contact_person, phone, email || null, gstin || null, initialCredit]
    );

    const supplierId = result.insertId;

    // If there is an initial credit balance, write an Invoice entry in the ledger
    if (initialCredit > 0) {
      await connection.query(
        `INSERT INTO supplier_ledger (shop_id, supplier_id, type, amount, balance_after, description) 
         VALUES (?, ?, 'Invoice', ?, ?, ?)`,
        [shopId, supplierId, initialCredit, initialCredit, 'Opening outstanding balance invoice']
      );
    }

    await connection.commit();
    res.status(201).json({
      message: 'Supplier created successfully.',
      supplierId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create supplier error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Get ledger for a single supplier (tenant-isolated)
exports.getSupplierLedger = async (req, res) => {
  const { id } = req.params;
  const shopId = req.user.shop_id;

  try {
    const [supplier] = await db.query('SELECT * FROM suppliers WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (supplier.length === 0) {
      return res.status(404).json({ message: 'Supplier not found.' });
    }

    const [ledger] = await db.query(
      'SELECT * FROM supplier_ledger WHERE supplier_id = ? AND shop_id = ? ORDER BY created_at DESC, id DESC',
      [id, shopId]
    );

    res.json({
      supplier: supplier[0],
      ledger
    });
  } catch (error) {
    console.error('Fetch supplier ledger error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Record a payment to a supplier credit balance atomically (tenant-isolated)
exports.paySupplierCredit = async (req, res) => {
  const { id } = req.params;
  const { amount, description } = req.body;
  const shopId = req.user.shop_id;

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ message: 'A valid positive payment amount is required.' });
  }

  const connection = await db.getPool().getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get current supplier details with lock (SELECT FOR UPDATE)
    const [supplier] = await connection.query(
      'SELECT credit_balance, shop_id FROM suppliers WHERE id = ? FOR UPDATE',
      [id]
    );

    if (supplier.length === 0 || supplier[0].shop_id !== shopId) {
      await connection.rollback();
      return res.status(404).json({ message: 'Supplier not found.' });
    }

    const currentBalance = parseFloat(supplier[0].credit_balance);
    const newBalance = currentBalance - paymentAmount;

    // 2. Update supplier's balance
    await connection.query(
      'UPDATE suppliers SET credit_balance = ? WHERE id = ? AND shop_id = ?',
      [newBalance, id, shopId]
    );

    // 3. Create a ledger record
    await connection.query(
      `INSERT INTO supplier_ledger (shop_id, supplier_id, type, amount, balance_after, description) 
       VALUES (?, ?, 'Payment', ?, ?, ?)`,
      [shopId, id, paymentAmount, newBalance, description || `Paid balance settlement.`]
    );

    await connection.commit();
    res.json({
      message: 'Payment recorded and ledger updated successfully.',
      newBalance
    });
  } catch (error) {
    await connection.rollback();
    console.error('Pay supplier error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Register a new consignment invoice (incoming purchase bill) from a supplier (tenant-isolated)
exports.receiveConsignmentInvoice = async (req, res) => {
  const { id } = req.params;
  const { invoice_number, amount, description } = req.body;
  const shopId = req.user.shop_id;

  const invoiceAmount = parseFloat(amount);
  if (!invoice_number || isNaN(invoiceAmount) || invoiceAmount <= 0) {
    return res.status(400).json({ message: 'A valid invoice number and positive bill amount are required.' });
  }

  const connection = await db.getPool().getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get current supplier details with lock
    const [supplier] = await connection.query(
      'SELECT credit_balance, shop_id FROM suppliers WHERE id = ? FOR UPDATE',
      [id]
    );

    if (supplier.length === 0 || supplier[0].shop_id !== shopId) {
      await connection.rollback();
      return res.status(404).json({ message: 'Supplier not found.' });
    }

    const currentBalance = parseFloat(supplier[0].credit_balance) || 0.00;
    const newBalance = currentBalance + invoiceAmount;

    // 2. Update supplier's credit outstanding balance
    await connection.query(
      'UPDATE suppliers SET credit_balance = ? WHERE id = ? AND shop_id = ?',
      [newBalance, id, shopId]
    );

    // 3. Create a ledger record for this Invoice
    await connection.query(
      `INSERT INTO supplier_ledger (shop_id, supplier_id, type, amount, balance_after, description) 
       VALUES (?, ?, 'Invoice', ?, ?, ?)`,
      [shopId, id, invoiceAmount, newBalance, description || `Consignment Invoice #${invoice_number}`]
    );

    await connection.commit();
    res.json({
      message: 'Consignment invoice logged and supplier outstanding balance updated successfully.',
      newBalance
    });
  } catch (error) {
    await connection.rollback();
    console.error('Record supplier invoice error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};
