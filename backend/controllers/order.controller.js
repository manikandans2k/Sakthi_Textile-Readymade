const db = require('../config/db');

// Upgraded order checkout for garments variants (Handles Split Payment, Customers, GST, Coupons, and Exchanges)
exports.createOrder = async (req, res) => {
  const { 
    items, 
    discount, 
    couponCode,
    cgstAmount,
    sgstAmount,
    netAmount,
    paymentMethod, // 'Cash', 'Card', 'UPI', 'Split', 'Credit'
    cashAmount, 
    cardAmount, 
    upiAmount,
    transactionType, // 'Sale', 'Return', 'Exchange'
    originalInvoiceNumber,
    customerId
  } = req.body;
  
  const userId = req.user.id;
  const shopId = req.user.shop_id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Item list is required to log invoice.' });
  }

  const pool = db.getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    const validatedItems = [];
    const txType = transactionType || 'Sale';

    // 1. Process and validate each garment variant item inside current shop
    for (const item of items) {
      const variantId = item.variantId || item.productId; // Support both variantId and productId keys
      
      const [variants] = await connection.query(
        `SELECT pv.*, p.product_name, p.brand, p.category, p.gender 
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         WHERE pv.id = ? AND pv.shop_id = ? FOR UPDATE`,
        [variantId, shopId]
      );

      if (variants.length === 0) {
        throw new Error(`Product Variant ID ${variantId} not found in inventory.`);
      }

      const variant = variants[0];
      const quantity = parseInt(item.quantity || item.qty) || 0;
      
      // Determine if this item line is a return or purchase
      const isLineReturn = item.isReturn || txType === 'Return';

      if (!isLineReturn && variant.stock_qty < quantity) {
        throw new Error(`Insufficient stock for "${variant.product_name} - ${variant.size} (${variant.color})". Available: ${variant.stock_qty} Pcs, Requested: ${quantity} Pcs.`);
      }

      const itemPrice = parseFloat(item.price !== undefined ? item.price : variant.selling_price);
      const subtotal = itemPrice * quantity;
      
      // Returns represent negative revenue, purchases are positive
      totalAmount += isLineReturn ? -subtotal : subtotal;

      // GST tax calculations: Selling price is inclusive of GST in garments retail.
      // Tax = (Price * GST / (100 + GST)) * Qty
      const gstPercent = parseFloat(variant.gst_percentage);
      const taxablePrice = itemPrice / (1 + (gstPercent / 100));
      const calculatedGst = (itemPrice - taxablePrice) * quantity;

      validatedItems.push({
        variantId: variant.id,
        name: `${variant.product_name} - ${variant.size}`,
        quantity,
        price: itemPrice,
        gst: item.gst !== undefined ? parseFloat(item.gst) : parseFloat(calculatedGst.toFixed(2)),
        subtotal: isLineReturn ? -subtotal : subtotal,
        isReturn: isLineReturn,
        newStock: isLineReturn ? (variant.stock_qty + quantity) : (variant.stock_qty - quantity)
      });
    }

    if (paymentMethod === 'Credit' && !customerId) {
      throw new Error('A customer profile must be linked to complete a Credit sale.');
    }

    // 2. Validate payment totals for split transactions
    const netVal = parseFloat(netAmount) || 0;
    const cashVal = parseFloat(cashAmount) || 0;
    const cardVal = parseFloat(cardAmount) || 0;
    const upiVal = parseFloat(upiAmount) || 0;
    const splitTotal = cashVal + cardVal + upiVal;

    // In return transactions, netVal might be negative (refund), so bypass split validation
    if (txType === 'Sale' && paymentMethod === 'Split' && Math.abs(splitTotal - netVal) > 0.05) {
      throw new Error(`Split payments sum (₹${splitTotal.toFixed(2)}) must exactly equal Net Payable (₹${netVal.toFixed(2)})`);
    }

    // 3. Generate invoice number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randStr = Math.floor(1000 + Math.random() * 9000);
    const invoicePrefix = txType === 'Return' ? 'RET' : txType === 'Exchange' ? 'EXC' : 'INV';
    const invoiceNumber = `${invoicePrefix}-${dateStr}-${randStr}`;

    // 4. Insert Order Log
    const discountVal = parseFloat(discount) || 0;
    const cgstVal = parseFloat(cgstAmount) || 0;
    const sgstVal = parseFloat(sgstAmount) || 0;

    const [orderResult] = await connection.query(
      `INSERT INTO orders (
        shop_id, invoice_number, user_id, customer_id, total_amount, discount, 
        coupon_code, cgst_amount, sgst_amount, net_amount, payment_method, 
        cash_amount, card_amount, upi_amount, transaction_type, original_invoice_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shopId,
        invoiceNumber,
        userId,
        customerId || null,
        totalAmount,
        discountVal,
        couponCode || null,
        cgstVal,
        sgstVal,
        netVal,
        paymentMethod || 'Split',
        paymentMethod === 'Cash' ? netVal : cashVal,
        paymentMethod === 'Card' ? netVal : cardVal,
        paymentMethod === 'UPI' ? netVal : upiVal,
        txType,
        originalInvoiceNumber || null
      ]
    );

    const orderId = orderResult.insertId;

    // 5. Insert Invoice Items and Update Inventory Stock levels (Global and Warehouse levels)
    const [warehouses] = await connection.query('SELECT id FROM warehouses WHERE shop_id = ? ORDER BY id DESC', [shopId]); // Order DESC so Retail Outlet (usually ID 2) is preferred!
    const preferredWarehouseId = warehouses.length > 0 ? warehouses[0].id : null;

    for (const item of validatedItems) {
      // Insert into invoice_items
      await connection.query(
        `INSERT INTO invoice_items (shop_id, order_id, variant_id, qty, price, gst, total) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          shopId,
          orderId,
          item.variantId,
          item.quantity,
          item.isReturn ? -item.price : item.price,
          item.isReturn ? -item.gst : item.gst,
          item.subtotal
        ]
      );

      // Update global variant stock_qty
      await connection.query(
        'UPDATE product_variants SET stock_qty = ? WHERE id = ? AND shop_id = ?',
        [item.newStock, item.variantId, shopId]
      );

      // Update warehouse-specific stock and write stock ledger
      if (preferredWarehouseId) {
        const [whStockRecord] = await connection.query(
          'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
          [item.variantId, preferredWarehouseId, shopId]
        );

        if (whStockRecord.length > 0) {
          const currentWhStock = parseInt(whStockRecord[0].stock) || 0;
          const newWhStock = item.isReturn ? (currentWhStock + item.quantity) : (currentWhStock - item.quantity);
          
          await connection.query(
            'UPDATE product_warehouse_stock SET stock = ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
            [newWhStock, item.variantId, preferredWarehouseId, shopId]
          );

          // Write Stock Ledger
          await connection.query(
            `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              shopId,
              item.variantId,
              preferredWarehouseId,
              item.isReturn ? 'Stock In' : 'Stock Out',
              item.quantity,
              `POS Checkout Invoice #${invoiceNumber}`
            ]
          );
        } else {
          // If warehouse mapping doesn't exist, create it
          await connection.query(
            'INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock) VALUES (?, ?, ?, ?)',
            [shopId, item.variantId, preferredWarehouseId, item.isReturn ? item.quantity : -item.quantity]
          );
        }
      }
    }

    // 6. Update customer loyalty points (1 point per ₹100 of positive net spend)
    if (customerId && txType !== 'Return' && netVal > 0) {
      const earnedPoints = Math.floor(netVal / 100);
      if (earnedPoints > 0) {
        await connection.query(
          'UPDATE customers SET loyalty_points = loyalty_points + ? WHERE id = ? AND shop_id = ?',
          [earnedPoints, customerId, shopId]
        );
      }
    }

    // 6b. Process Credit payments if selected
    if (customerId && paymentMethod === 'Credit' && txType !== 'Return' && netVal > 0) {
      const [customerRecord] = await connection.query(
        'SELECT credit_balance FROM customers WHERE id = ? AND shop_id = ? FOR UPDATE',
        [customerId, shopId]
      );
      if (customerRecord.length === 0) {
        throw new Error('Customer linked to credit sale not found.');
      }
      const currentCredit = parseFloat(customerRecord[0].credit_balance) || 0;
      const newCredit = currentCredit + netVal;
      
      await connection.query(
        'UPDATE customers SET credit_balance = ? WHERE id = ? AND shop_id = ?',
        [newCredit, customerId, shopId]
      );

      // Log invoice inside customer ledger
      await connection.query(
        `INSERT INTO customer_ledger (shop_id, customer_id, type, amount, balance_after, description) 
         VALUES (?, ?, 'Invoice', ?, ?, ?)`,
        [shopId, customerId, netVal, newCredit, `Credit sale invoice #${invoiceNumber}`]
      );
    }

    await connection.commit();
    connection.release();

    res.status(201).json({
      message: `${txType} transaction successful.`,
      invoiceNumber,
      orderId,
      totalAmount,
      discount: discountVal,
      netAmount: netVal,
      paymentMethod,
      transactionType: txType
    });

  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('Garments checkout transactional failure:', error);
    res.status(400).json({ message: error.message || 'Checkout failed.' });
  }
};

// Fetch order sales history
exports.getAllOrders = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    const queryStr = `
      SELECT o.*, u.username as cashier_name,
             COALESCE(c.name, 'Walk-In Customer') as customer_name,
             COUNT(ii.id) as total_items
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id AND c.shop_id = ?
      LEFT JOIN invoice_items ii ON o.id = ii.order_id AND ii.shop_id = ?
      WHERE o.shop_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    const [orders] = await db.query(queryStr, [shopId, shopId, shopId]);
    res.json(orders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Get specific order details (Thermal print formats, etc.)
exports.getOrderDetails = async (req, res) => {
  const { id } = req.params;
  const shopId = req.user.shop_id;
  try {
    const [orders] = await db.query(
      `SELECT o.*, u.username as cashier_name,
              c.name as customer_name, c.phone as customer_phone
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ? AND o.shop_id = ?`, 
      [id, shopId]
    );

    if (orders.length === 0) {
      // Check if ID is an invoice_number instead
      const [invoiceOrders] = await db.query(
        `SELECT o.*, u.username as cashier_name,
                c.name as customer_name, c.phone as customer_phone
         FROM orders o 
         JOIN users u ON o.user_id = u.id 
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.invoice_number = ? AND o.shop_id = ?`, 
        [id, shopId]
      );
      if (invoiceOrders.length === 0) {
        return res.status(404).json({ message: 'Invoice not found.' });
      }
      orders.push(invoiceOrders[0]);
    }

    const order = orders[0];

    const [items] = await db.query(
      `SELECT 
          ii.id,
          ii.order_id,
          ii.variant_id,
          ii.qty AS quantity,
          ii.qty,
          ii.price,
          ii.gst,
          ii.total AS subtotal,
          ii.total,
          p.product_name AS product_name,
          p.product_name AS name,
          pv.sku,
          pv.size,
          pv.color,
          'Pcs' AS unit
       FROM invoice_items ii
       JOIN product_variants pv ON ii.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE ii.order_id = ? AND ii.shop_id = ?`,
      [order.id, shopId]
    );

    res.json({
      ...order,
      items
    });
  } catch (error) {
    console.error('Fetch order details error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
