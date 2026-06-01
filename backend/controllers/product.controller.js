const db = require('../config/db');

// Get all products (with optional search string filter)
exports.getAllProducts = async (req, res) => {
  const { q } = req.query;
  const shopId = req.user.shop_id;

  try {
    if (q) {
      const searchTerm = `%${q}%`;
      const queryStr = `
        SELECT 
            pv.id,
            pv.product_id,
            pv.barcode,
            pv.sku,
            pv.color,
            pv.size,
            pv.purchase_price,
            pv.purchase_price AS cost_price,
            pv.selling_price,
            pv.selling_price AS price,
            pv.mrp,
            pv.stock_qty AS stock,
            pv.gst_percentage,
            pv.image,
            p.product_name,
            p.brand,
            p.category,
            p.gender,
            p.description,
            p.product_name AS name,
            p.allow_manual_qty,
            'Pcs' AS unit
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.shop_id = ? AND (p.product_name LIKE ? 
           OR pv.barcode = ? 
           OR pv.sku LIKE ? 
           OR p.category LIKE ?
           OR p.brand LIKE ?)
        ORDER BY p.product_name ASC, pv.size ASC
        LIMIT 50
      `;
      const [products] = await db.query(queryStr, [shopId, searchTerm, q, searchTerm, searchTerm, searchTerm]);
      return res.json(products);
    }

    const [products] = await db.query(`
      SELECT 
          pv.id,
          pv.product_id,
          pv.barcode,
          pv.sku,
          pv.color,
          pv.size,
          pv.purchase_price,
          pv.purchase_price AS cost_price,
          pv.selling_price,
          pv.selling_price AS price,
          pv.mrp,
          pv.stock_qty AS stock,
          pv.gst_percentage,
          pv.image,
          p.product_name,
          p.brand,
          p.category,
          p.gender,
          p.description,
          p.product_name AS name,
          p.allow_manual_qty,
          'Pcs' AS unit
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.shop_id = ?
      ORDER BY p.product_name ASC, pv.size ASC
    `, [shopId]);
    res.json(products);
  } catch (error) {
    console.error('Fetch/Search products error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Look up a product variant by barcode (POS scannable endpoint)
exports.getProductByBarcode = async (req, res) => {
  const { barcode } = req.params;
  const shopId = req.user.shop_id;
  try {
    const [variants] = await db.query(`
      SELECT 
          pv.id,
          pv.product_id,
          pv.barcode,
          pv.sku,
          pv.color,
          pv.size,
          pv.purchase_price,
          pv.purchase_price AS cost_price,
          pv.selling_price,
          pv.selling_price AS price,
          pv.mrp,
          pv.stock_qty AS stock,
          pv.gst_percentage,
          pv.image,
          p.product_name,
          p.brand,
          p.category,
          p.gender,
          p.description,
          p.product_name AS name,
          p.allow_manual_qty,
          'Pcs' AS unit
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.barcode = ? AND pv.shop_id = ?
    `, [barcode, shopId]);

    if (variants.length === 0) {
      return res.status(404).json({ message: 'Product variant not found.' });
    }
    res.json(variants[0]);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Create a new product variant
exports.createProduct = async (req, res) => {
  const shopId = req.user.shop_id;
  const {
    product_name,
    name, // compatibility
    brand,
    category,
    gender,
    description,
    allow_manual_qty, // New property
    barcode,
    sku,
    color,
    size,
    purchase_price,
    cost_price, // compatibility
    selling_price,
    price, // compatibility
    mrp,
    stock_qty,
    stock, // compatibility
    gst_percentage
  } = req.body;

  const resolvedProductName = product_name || name;
  const resolvedBarcode = barcode;
  const resolvedSku = sku;
  const resolvedPrice = selling_price !== undefined ? selling_price : price;
  const resolvedCost = purchase_price !== undefined ? purchase_price : (cost_price !== undefined ? cost_price : 0.00);
  const resolvedStock = stock_qty !== undefined ? stock_qty : (stock !== undefined ? stock : 0);

  if (!resolvedBarcode || !resolvedProductName || !resolvedSku || resolvedPrice === undefined) {
    return res.status(400).json({ message: 'Barcode, Name/ProductName, SKU, and Price/SellingPrice are required.' });
  }

  try {
    // Check barcode/sku collisions inside current shop
    const [existing] = await db.query('SELECT id FROM product_variants WHERE (barcode = ? OR sku = ?) AND shop_id = ?', [resolvedBarcode, resolvedSku, shopId]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'this barcode is already there pls add unique and SKU Code' });
    }

    // Get or Create parent Product inside current shop
    let productId;
    const [existingProducts] = await db.query('SELECT id FROM products WHERE product_name = ? AND shop_id = ?', [resolvedProductName, shopId]);
    if (existingProducts.length > 0) {
      productId = existingProducts[0].id;
    } else {
      const [prodRes] = await db.query(
        'INSERT INTO products (shop_id, product_name, brand, category, gender, description, allow_manual_qty) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [shopId, resolvedProductName, brand || 'General', category || 'General', gender || 'Unisex', description || '', allow_manual_qty !== undefined ? !!allow_manual_qty : false]
      );
      productId = prodRes.insertId;
    }

    // Insert variant
    const [varRes] = await db.query(`
      INSERT INTO product_variants (
        shop_id, product_id, barcode, sku, color, size, purchase_price, selling_price, mrp, stock_qty, gst_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shopId,
      productId,
      resolvedBarcode,
      resolvedSku,
      color || 'Standard',
      size || 'Free Size',
      resolvedCost,
      resolvedPrice,
      mrp || resolvedPrice,
      resolvedStock,
      gst_percentage || 12.00
    ]);

    const variantId = varRes.insertId;

    // Distribute stock to warehouses if > 0
    if (resolvedStock > 0) {
      const [warehouses] = await db.query('SELECT id FROM warehouses WHERE shop_id = ?', [shopId]);
      if (warehouses.length > 0) {
        const w1 = warehouses[0].id;
        const w2 = warehouses.length > 1 ? warehouses[1].id : w1;

        const s1 = Math.round(resolvedStock * 0.7);
        const s2 = resolvedStock - s1;

        await db.query(`
          INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock)
          VALUES (?, ?, ?, ?), (?, ?, ?, ?)
        `, [shopId, variantId, w1, s1, shopId, variantId, w2, s2]);

        await db.query(`
          INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference)
          VALUES (?, ?, ?, 'Stock In', ?, 'Initial Seeding'),
                 (?, ?, ?, 'Stock In', ?, 'Initial Seeding')
        `, [shopId, variantId, w1, s1, shopId, variantId, w2, s2]);
      }
    }

    res.status(201).json({
      message: 'Product variant created successfully',
      productId: variantId
    });
  } catch (error) {
    console.error('Create product variant error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Update a product variant
exports.updateProduct = async (req, res) => {
  const { id } = req.params; // variant_id
  const shopId = req.user.shop_id;
  const {
    product_name,
    name, // compatibility
    brand,
    category,
    gender,
    description,
    allow_manual_qty, // New property
    barcode,
    sku,
    color,
    size,
    purchase_price,
    cost_price, // compatibility
    selling_price,
    price, // compatibility
    mrp,
    stock_qty,
    stock, // compatibility
    gst_percentage
  } = req.body;

  try {
    const [variants] = await db.query('SELECT * FROM product_variants WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (variants.length === 0) {
      return res.status(404).json({ message: 'Product variant not found.' });
    }

    const currentVariant = variants[0];

    // Check barcode/sku collisions if changed
    if (barcode || sku) {
      const [existing] = await db.query(
        'SELECT id FROM product_variants WHERE (barcode = ? OR sku = ?) AND id != ? AND shop_id = ?',
        [barcode || '', sku || '', id, shopId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ message: 'this barcode is already there pls add unique and SKU Code' });
      }
    }

    const resolvedPrice = selling_price !== undefined ? selling_price : price;
    const resolvedCost = purchase_price !== undefined ? purchase_price : cost_price;
    const resolvedStock = stock_qty !== undefined ? stock_qty : stock;

    await db.query(
      `UPDATE product_variants SET 
        barcode = ?, 
        sku = ?, 
        color = ?, 
        size = ?, 
        purchase_price = ?, 
        selling_price = ?, 
        mrp = ?, 
        stock_qty = ?, 
        gst_percentage = ? 
      WHERE id = ? AND shop_id = ?`,
      [
        barcode || currentVariant.barcode,
        sku || currentVariant.sku,
        color || currentVariant.color,
        size || currentVariant.size,
        resolvedCost !== undefined ? resolvedCost : currentVariant.purchase_price,
        resolvedPrice !== undefined ? resolvedPrice : currentVariant.selling_price,
        mrp !== undefined ? mrp : currentVariant.mrp,
        resolvedStock !== undefined ? resolvedStock : currentVariant.stock_qty,
        gst_percentage !== undefined ? gst_percentage : currentVariant.gst_percentage,
        id,
        shopId
      ]
    );

    // Sync warehouse stock if resolvedStock changes
    if (resolvedStock !== undefined) {
      const oldStock = currentVariant.stock_qty || 0;
      const newStock = parseInt(resolvedStock, 10) || 0;
      const diff = newStock - oldStock;

      if (diff !== 0) {
        // Query current allocations inside current shop
        const [allocations] = await db.query('SELECT * FROM product_warehouse_stock WHERE variant_id = ? AND shop_id = ?', [id, shopId]);
        if (allocations.length > 0) {
          // Adjust the primary warehouse allocation
          const primaryAlloc = allocations[0];
          const newAllocStock = Math.max(0, primaryAlloc.stock + diff);
          
          await db.query(
            'UPDATE product_warehouse_stock SET stock = ? WHERE variant_id = ? AND warehouse_id = ? AND shop_id = ?',
            [newAllocStock, id, primaryAlloc.warehouse_id, shopId]
          );

          // Log the direct adjustment transaction
          await db.query(`
            INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference)
            VALUES (?, ?, ?, 'Stock Adjustment', ?, 'Direct Admin Catalog Override')
          `, [shopId, id, primaryAlloc.warehouse_id, diff]);
        } else {
          // Seeding to warehouses if there was no prior allocation
          const [warehouses] = await db.query('SELECT id FROM warehouses WHERE shop_id = ?', [shopId]);
          if (warehouses.length > 0) {
            const w1 = warehouses[0].id;
            const w2 = warehouses.length > 1 ? warehouses[1].id : w1;
            const s1 = Math.round(newStock * 0.7);
            const s2 = newStock - s1;

            await db.query(`
              INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock)
              VALUES (?, ?, ?, ?), (?, ?, ?, ?)
            `, [shopId, id, w1, s1, shopId, id, w2, s2]);

            await db.query(`
              INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference)
              VALUES (?, ?, ?, 'Stock In', ?, 'Direct Admin Catalog Seeding'),
                     (?, ?, ?, 'Stock In', ?, 'Direct Admin Catalog Seeding')
            `, [shopId, id, w1, s1, shopId, id, w2, s2]);
          }
        }
      }
    }

    // Update parent product if product level fields are modified
    const resolvedProductName = product_name || name;
    if (resolvedProductName || brand || category || gender || description || allow_manual_qty !== undefined) {
      const [prods] = await db.query('SELECT * FROM products WHERE id = ? AND shop_id = ?', [currentVariant.product_id, shopId]);
      if (prods.length > 0) {
        const prod = prods[0];
        await db.query(
          `UPDATE products SET 
            product_name = ?, 
            brand = ?, 
            category = ?, 
            gender = ?, 
            description = ?,
            allow_manual_qty = ?
          WHERE id = ? AND shop_id = ?`,
          [
            resolvedProductName || prod.product_name,
            brand || prod.brand,
            category || prod.category,
            gender || prod.gender,
            description || prod.description,
            allow_manual_qty !== undefined ? !!allow_manual_qty : prod.allow_manual_qty,
            currentVariant.product_id,
            shopId
          ]
        );
      }
    }

    res.json({ message: 'Product variant updated successfully.' });
  } catch (error) {
    console.error('Update product variant error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Delete a product variant
exports.deleteProduct = async (req, res) => {
  const { id } = req.params; // variant ID
  const shopId = req.user.shop_id;
  try {
    const [result] = await db.query('DELETE FROM product_variants WHERE id = ? AND shop_id = ?', [id, shopId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product variant not found.' });
    }
    res.json({ message: 'Product variant deleted successfully.' });
  } catch (error) {
    console.error('Delete product variant error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
