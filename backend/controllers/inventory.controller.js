const db = require('../config/db');

// Retrieve stock ledger history with optional filters (warehouse, variant, type)
exports.getStockLedger = async (req, res) => {
  const { warehouse_id, product_id, variant_id, type } = req.query;
  const resolvedVariantId = variant_id || product_id; // Support both names
  const shopId = req.user.shop_id;

  try {
    let queryStr = `
      SELECT sl.*,
             p.product_name as product_name,
             p.product_name as name,
             pv.sku,
             pv.color,
             pv.size,
             'Pcs' as unit,
             w.name as warehouse_name
      FROM stock_ledger sl
      JOIN product_variants pv ON sl.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN warehouses w ON sl.warehouse_id = w.id
    `;
    const conditions = ['sl.shop_id = ?'];
    const params = [shopId];

    if (warehouse_id) {
      conditions.push('sl.warehouse_id = ?');
      params.push(warehouse_id);
    }
    if (resolvedVariantId) {
      conditions.push('sl.variant_id = ?');
      params.push(resolvedVariantId);
    }
    if (type) {
      conditions.push('sl.type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY sl.created_at DESC, sl.id DESC';

    const [ledger] = await db.query(queryStr, params);
    res.json(ledger);
  } catch (error) {
    console.error('Fetch stock ledger error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Retrieve low stock alerts across the system (pieces stock <= 10)
exports.getLowStockAlerts = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    const queryStr = `
      SELECT pv.id, p.product_name AS name, pv.sku, pv.barcode, p.category, pv.stock_qty AS stock, 'Pcs' AS unit, pv.selling_price AS price, pv.color, pv.size
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.stock_qty <= 10 AND pv.shop_id = ?
      ORDER BY pv.stock_qty ASC, p.product_name ASC
    `;
    const [products] = await db.query(queryStr, [shopId]);
    res.json(products);
  } catch (error) {
    console.error('Fetch low stock alerts error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Process Stock In (Adds stock to warehouse and variant overall inventory)
exports.processStockIn = async (req, res) => {
  const { product_id, variant_id, warehouse_id, quantity, reference } = req.body;
  const resolvedVariantId = variant_id || product_id; // Support both product_id and variant_id names
  const shopId = req.user.shop_id;

  const qty = parseInt(quantity) || 0;
  if (!resolvedVariantId || !warehouse_id || qty <= 0) {
    return res.status(400).json({ message: 'Product Variant, warehouse, and positive quantity are required.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Verify variant and warehouse exist for this shop
    const [variantExists] = await connection.query('SELECT id, stock_qty FROM product_variants WHERE id = ? AND shop_id = ?', [resolvedVariantId, shopId]);
    const [whExists] = await connection.query('SELECT id FROM warehouses WHERE id = ? AND shop_id = ?', [warehouse_id, shopId]);

    if (variantExists.length === 0 || whExists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Product Variant or Warehouse not found in your shop.' });
    }

    // 2. Insert or update the product_warehouse_stock entry
    const [existingStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
      [resolvedVariantId, warehouse_id, shopId]
    );

    if (existingStock.length > 0) {
      await connection.query(
        'UPDATE product_warehouse_stock SET stock = stock + ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
        [qty, resolvedVariantId, warehouse_id, shopId]
      );
    } else {
      await connection.query(
        'INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock) VALUES (?, ?, ?, ?)',
        [shopId, resolvedVariantId, warehouse_id, qty]
      );
    }

    // 3. Update overall product variant stock_qty
    await connection.query(
      'UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ? AND shop_id = ?',
      [qty, resolvedVariantId, shopId]
    );

    // 4. Record stock ledger entry
    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, ?, 'Stock In', ?, ?)`,
      [shopId, resolvedVariantId, warehouse_id, qty, reference || 'Stock replenishment']
    );

    await connection.commit();
    res.status(200).json({ message: 'Garment stock added successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Stock In error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Process Stock Out (Deducts stock from warehouse and overall product variant inventory)
exports.processStockOut = async (req, res) => {
  const { product_id, variant_id, warehouse_id, quantity, reference } = req.body;
  const resolvedVariantId = variant_id || product_id;
  const shopId = req.user.shop_id;

  const qty = parseInt(quantity) || 0;
  if (!resolvedVariantId || !warehouse_id || qty <= 0) {
    return res.status(400).json({ message: 'Product Variant, warehouse, and positive quantity are required.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check local warehouse stock inside current shop
    const [existingStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
      [resolvedVariantId, warehouse_id, shopId]
    );

    if (existingStock.length === 0 || existingStock[0].stock < qty) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Insufficient stock in selected warehouse. Available: ${existingStock.length > 0 ? existingStock[0].stock : 0}` 
      });
    }

    // 2. Decrement local stock
    await connection.query(
      'UPDATE product_warehouse_stock SET stock = stock - ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
      [qty, resolvedVariantId, warehouse_id, shopId]
    );

    // 3. Decrement overall product variant stock_qty
    await connection.query(
      'UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND shop_id = ?',
      [qty, resolvedVariantId, shopId]
    );

    // 4. Record stock ledger entry
    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, 'Stock Out', ?, ?)`,
      [shopId, resolvedVariantId, warehouse_id, qty, reference || 'Stock dispatch']
    );

    await connection.commit();
    res.status(200).json({ message: 'Garment stock dispatched successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Stock Out error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Process Stock Transfer (Moves inventory from one warehouse to another)
exports.processStockTransfer = async (req, res) => {
  const { product_id, variant_id, source_warehouse_id, target_warehouse_id, quantity, reference } = req.body;
  const resolvedVariantId = variant_id || product_id;
  const shopId = req.user.shop_id;

  const qty = parseInt(quantity) || 0;
  if (!resolvedVariantId || !source_warehouse_id || !target_warehouse_id || qty <= 0) {
    return res.status(400).json({ message: 'Product Variant, source warehouse, target warehouse, and positive quantity are required.' });
  }

  if (parseInt(source_warehouse_id) === parseInt(target_warehouse_id)) {
    return res.status(400).json({ message: 'Source and Target warehouses cannot be the same.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // Fetch warehouse names for descriptive reference logs inside current shop
    const [warehouses] = await connection.query(
      'SELECT id, name FROM warehouses WHERE id IN (?, ?) AND shop_id = ?',
      [source_warehouse_id, target_warehouse_id, shopId]
    );
    const sourceWh = warehouses.find(w => w.id == source_warehouse_id);
    const targetWh = warehouses.find(w => w.id == target_warehouse_id);

    if (!sourceWh || !targetWh) {
      await connection.rollback();
      return res.status(404).json({ message: 'One or both warehouses do not exist in your shop.' });
    }

    // 1. Check source warehouse stock
    const [sourceStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
      [resolvedVariantId, source_warehouse_id, shopId]
    );

    if (sourceStock.length === 0 || sourceStock[0].stock < qty) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Insufficient stock in source warehouse "${sourceWh.name}". Available: ${sourceStock.length > 0 ? sourceStock[0].stock : 0}` 
      });
    }

    // 2. Decrement source warehouse stock
    await connection.query(
      'UPDATE product_warehouse_stock SET stock = stock - ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
      [qty, resolvedVariantId, source_warehouse_id, shopId]
    );

    // 3. Increment target warehouse stock
    const [targetStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
      [resolvedVariantId, target_warehouse_id, shopId]
    );

    if (targetStock.length > 0) {
      await connection.query(
        'UPDATE product_warehouse_stock SET stock = stock + ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
        [qty, resolvedVariantId, target_warehouse_id, shopId]
      );
    } else {
      await connection.query(
        'INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock) VALUES (?, ?, ?, ?)',
        [shopId, resolvedVariantId, target_warehouse_id, qty]
      );
    }

    // 4. Log two ledger movements
    const memo = reference || 'Warehouse internal stock relocation';
    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, 'Stock Transfer', ?, ?)`,
      [shopId, resolvedVariantId, source_warehouse_id, qty, `Relocated to ${targetWh.name}. Note: ${memo}`]
    );

    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, 'Stock Transfer', ?, ?)`,
      [shopId, resolvedVariantId, target_warehouse_id, qty, `Received from ${sourceWh.name}. Note: ${memo}`]
    );

    await connection.commit();
    res.status(200).json({ message: 'Stock transferred successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Stock Transfer error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Process Damage Stock (Deducts stock from warehouse and overall product variant inventory)
exports.processDamageStock = async (req, res) => {
  const { product_id, variant_id, warehouse_id, quantity, reference } = req.body;
  const resolvedVariantId = variant_id || product_id;
  const shopId = req.user.shop_id;

  const qty = parseInt(quantity) || 0;
  if (!resolvedVariantId || !warehouse_id || qty <= 0) {
    return res.status(400).json({ message: 'Product Variant, warehouse, and positive quantity are required.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Check local warehouse stock inside current shop
    const [existingStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
      [resolvedVariantId, warehouse_id, shopId]
    );

    if (existingStock.length === 0 || existingStock[0].stock < qty) {
      await connection.rollback();
      return res.status(400).json({ 
        message: `Insufficient stock in selected warehouse. Available: ${existingStock.length > 0 ? existingStock[0].stock : 0}` 
      });
    }

    // 2. Decrement local stock
    await connection.query(
      'UPDATE product_warehouse_stock SET stock = stock - ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
      [qty, resolvedVariantId, warehouse_id, shopId]
    );

    // 3. Decrement overall variant stock_qty
    await connection.query(
      'UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ? AND shop_id = ?',
      [qty, resolvedVariantId, shopId]
    );

    // 4. Record stock ledger entry (type: 'Damage')
    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, 'Damage', ?, ?)`,
      [shopId, resolvedVariantId, warehouse_id, qty, reference || 'Damaged goods write-off']
    );

    await connection.commit();
    res.status(200).json({ message: 'Damage stock logged and inventory adjusted successfully.' });
  } catch (error) {
    await connection.rollback();
    console.error('Damage Stock logging error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Process Stock Adjustment
exports.processStockAdjustment = async (req, res) => {
  const { product_id, variant_id, warehouse_id, adjustment_type, quantity, reference } = req.body;
  const resolvedVariantId = variant_id || product_id;
  const shopId = req.user.shop_id;

  const qty = parseInt(quantity);
  if (!resolvedVariantId || !warehouse_id || !adjustment_type || isNaN(qty)) {
    return res.status(400).json({ message: 'Product Variant, warehouse, adjustment type, and quantity are required.' });
  }

  if (!['add', 'subtract', 'set'].includes(adjustment_type)) {
    return res.status(400).json({ message: 'Invalid adjustment type. Must be add, subtract or set.' });
  }

  if (qty < 0 && ['add', 'subtract'].includes(adjustment_type)) {
    return res.status(400).json({ message: 'Adjustment quantity must be positive for add/subtract operations.' });
  }

  if (adjustment_type === 'set' && qty < 0) {
    return res.status(400).json({ message: 'Cannot set inventory stock to a negative level.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // Verify variant and warehouse exist inside current shop
    const [variantExists] = await connection.query('SELECT id, stock_qty FROM product_variants WHERE id = ? AND shop_id = ? FOR UPDATE', [resolvedVariantId, shopId]);
    const [whExists] = await connection.query('SELECT id FROM warehouses WHERE id = ? AND shop_id = ?', [warehouse_id, shopId]);

    if (variantExists.length === 0 || whExists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Product Variant or Warehouse not found in your shop.' });
    }

    // Get current local warehouse stock level
    const [localStock] = await connection.query(
      'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
      [resolvedVariantId, warehouse_id, shopId]
    );
    const currentLocalStock = localStock.length > 0 ? parseInt(localStock[0].stock) : 0;

    let delta = 0;
    let newLocalStock = 0;

    if (adjustment_type === 'add') {
      delta = qty;
      newLocalStock = currentLocalStock + qty;
    } else if (adjustment_type === 'subtract') {
      if (currentLocalStock < qty) {
        await connection.rollback();
        return res.status(400).json({ 
          message: `Insufficient warehouse stock for subtraction. Current: ${currentLocalStock}` 
        });
      }
      delta = -qty;
      newLocalStock = currentLocalStock - qty;
    } else if (adjustment_type === 'set') {
      delta = qty - currentLocalStock;
      newLocalStock = qty;
    }

    // Update or Insert localized warehouse stock
    if (localStock.length > 0) {
      await connection.query(
        'UPDATE product_warehouse_stock SET stock = ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
        [newLocalStock, resolvedVariantId, warehouse_id, shopId]
      );
    } else {
      await connection.query(
        'INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock) VALUES (?, ?, ?, ?)',
        [shopId, resolvedVariantId, warehouse_id, newLocalStock]
      );
    }

    // Update overall product variant stock by the delta offset
    await connection.query(
      'UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ? AND shop_id = ?',
      [delta, resolvedVariantId, shopId]
    );

    // Record stock ledger entry (type: 'Stock Adjustment')
    await connection.query(
      `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
       VALUES (?, ?, ?, 'Stock Adjustment', ?, ?)`,
      [shopId, resolvedVariantId, warehouse_id, delta, reference || `Manual Stock Adjustment (${adjustment_type.toUpperCase()})`]
    );

    await connection.commit();
    res.status(200).json({ 
      message: 'Stock adjusted successfully.', 
      previousStock: currentLocalStock, 
      newStock: newLocalStock, 
      delta 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Process Stock Adjustment error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    connection.release();
  }
};

// Process Stock Reconciliation
exports.processStockReconciliation = async (req, res) => {
  const { warehouse_id, items, reference } = req.body;
  const shopId = req.user.shop_id;

  if (!warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Warehouse and a list of physical items count are required.' });
  }

  const connection = await db.getPool().getConnection();
  try {
    await connection.beginTransaction();

    // Verify warehouse exists in current shop
    const [whExists] = await connection.query('SELECT id, name FROM warehouses WHERE id = ? AND shop_id = ?', [warehouse_id, shopId]);
    if (whExists.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Reconciliation Warehouse not found in your shop.' });
    }
    const warehouseName = whExists[0].name;

    const auditResults = [];

    for (const item of items) {
      const variant_id = parseInt(item.variant_id || item.product_id); // Support both name properties
      const physical_qty = parseInt(item.physical_qty);

      if (isNaN(variant_id) || isNaN(physical_qty) || physical_qty < 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'Invalid variant ID or negative physical count provided.' });
      }

      // Lock product variant & warehouse stocks inside current shop
      const [variantRow] = await connection.query(`
        SELECT pv.id, p.product_name, pv.sku, pv.color, pv.size 
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.id = ? AND pv.shop_id = ? FOR UPDATE
      `, [variant_id, shopId]);

      if (variantRow.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: `Product Variant ID ${variant_id} not found.` });
      }

      const [localStock] = await connection.query(
        'SELECT stock FROM product_warehouse_stock WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ? FOR UPDATE',
        [variant_id, warehouse_id, shopId]
      );
      const system_qty = localStock.length > 0 ? parseInt(localStock[0].stock) : 0;
      const discrepancy = physical_qty - system_qty;

      if (discrepancy !== 0) {
        // Update product_warehouse_stock
        if (localStock.length > 0) {
          await connection.query(
            'UPDATE product_warehouse_stock SET stock = ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
            [physical_qty, variant_id, warehouse_id, shopId]
          );
        } else {
          await connection.query(
            'INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock) VALUES (?, ?, ?, ?)',
            [shopId, variant_id, warehouse_id, physical_qty]
          );
        }

        // Update overall products variant stock_qty
        await connection.query(
          'UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ? AND shop_id = ?',
          [discrepancy, variant_id, shopId]
        );

        // Record entry to stock ledger
        const memo = `Stock Reconciliation Audit discrepancy at "${warehouseName}". Physical Count: ${physical_qty}, System Count: ${system_qty}. Note: ${reference || 'Routine audit'}`;
        await connection.query(
          `INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference) 
           VALUES (?, ?, ?, 'Stock Reconciliation', ?, ?)`,
          [shopId, variant_id, warehouse_id, discrepancy, memo]
        );
      }

      auditResults.push({
        variant_id,
        name: `${variantRow[0].product_name} - ${variantRow[0].size} (${variantRow[0].color})`,
        sku: variantRow[0].sku,
        system_qty,
        physical_qty,
        discrepancy
      });
    }

    await connection.commit();
    res.status(200).json({ 
      message: 'Stock reconciliation transaction completed successfully.', 
      warehouseName,
      reconciliationLog: auditResults 
    });
  } catch (error) {
    await connection.rollback();
    console.error('Process Stock Reconciliation error:', error);
    res.status(500).json({ message: 'Internal server error during atomic reconciliation.' });
  } finally {
    connection.release();
  }
};

// Retrieve Inventory Valuation data
exports.getInventoryValuation = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    // 1. Overall summary calculation
    const [summaryResult] = await db.query(`
      SELECT COALESCE(SUM(stock_qty), 0) AS total_qty, 
             COALESCE(SUM(stock_qty * selling_price), 0) AS total_value 
      FROM product_variants
      WHERE shop_id = ?
    `, [shopId]);
    const totalQty = parseFloat(summaryResult[0].total_qty);
    const totalValue = parseFloat(summaryResult[0].total_value);
    const avgCostPerUnit = totalQty > 0 ? (totalValue / totalQty) : 0.00;

    // 2. Warehouse asset valuation split
    const [warehouseResult] = await db.query(`
      SELECT w.id, w.name, w.location, 
             COALESCE(SUM(pws.stock), 0) AS total_qty, 
             COALESCE(SUM(pws.stock * pv.selling_price), 0) AS total_value 
      FROM product_warehouse_stock pws 
      JOIN product_variants pv ON pws.variant_id = pv.id 
      JOIN warehouses w ON pws.warehouse_id = w.id 
      WHERE pws.shop_id = ?
      GROUP BY w.id, w.name, w.location
      ORDER BY total_value DESC
    `, [shopId]);

    // 3. Item-wise product SKU valuation details
    const [productResult] = await db.query(`
      SELECT pv.id, pv.barcode, p.product_name AS name, pv.sku, p.category, pv.selling_price AS price, pv.stock_qty AS stock, 'Pcs' AS unit, 
             (pv.stock_qty * pv.selling_price) AS total_value, pv.color, pv.size
      FROM product_variants pv 
      JOIN products p ON pv.product_id = p.id
      WHERE pv.shop_id = ?
      ORDER BY total_value DESC, p.product_name ASC
    `, [shopId]);

    res.json({
      summary: {
        total_qty: totalQty,
        total_value: totalValue,
        avg_cost_per_unit: avgCostPerUnit
      },
      warehouseValuations: warehouseResult.map(row => ({
        id: row.id,
        name: row.name,
        location: row.location,
        total_qty: parseFloat(row.total_qty),
        total_value: parseFloat(row.total_value)
      })),
      productValuations: productResult.map(row => ({
        id: row.id,
        barcode: row.barcode,
        name: `${row.name} - ${row.size} (${row.color})`,
        sku: row.sku,
        category: row.category,
        price: parseFloat(row.price),
        stock: parseFloat(row.stock),
        unit: row.unit,
        total_value: parseFloat(row.total_value)
      }))
    });
  } catch (error) {
    console.error('Fetch inventory valuation error:', error);
    res.status(500).json({ message: 'Internal server error fetching valuation details.' });
  }
};
