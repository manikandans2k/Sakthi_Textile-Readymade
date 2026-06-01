const db = require('../config/db');

// List all warehouses with current stock totals (filtered by tenant)
exports.getAllWarehouses = async (req, res) => {
  try {
    const queryStr = `
      SELECT w.*, 
             COALESCE(SUM(pws.stock), 0) as current_stock_units,
             COUNT(pws.variant_id) as total_allocated_products
      FROM warehouses w
      LEFT JOIN product_warehouse_stock pws ON w.id = pws.warehouse_id
      WHERE w.shop_id = ?
      GROUP BY w.id
      ORDER BY w.name ASC
    `;
    const [warehouses] = await db.query(queryStr, [req.user.shop_id]);
    res.json(warehouses);
  } catch (error) {
    console.error('Fetch warehouses error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Create a new warehouse
exports.createWarehouse = async (req, res) => {
  const { name, location, capacity } = req.body;

  if (!name || !location) {
    return res.status(400).json({ message: 'Warehouse name and location are required.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO warehouses (shop_id, name, location, capacity) VALUES (?, ?, ?, ?)',
      [req.user.shop_id, name, location, parseInt(capacity) || 10000]
    );

    res.status(201).json({
      message: 'Warehouse created successfully.',
      warehouseId: result.insertId
    });
  } catch (error) {
    console.error('Create warehouse error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

// Retrieve specific stock breakdown inside a warehouse (tenant-isolated)
exports.getWarehouseStock = async (req, res) => {
  const { id } = req.params;
  try {
    const queryStr = `
      SELECT pws.stock as localized_stock,
             pv.id as product_id, p.product_name as product_name, pv.sku, p.category, 'Pcs' as unit, pv.selling_price as price
      FROM product_warehouse_stock pws
      JOIN product_variants pv ON pws.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE pws.warehouse_id = ? AND pws.shop_id = ?
      ORDER BY p.product_name ASC
    `;
    const [stockBreakdown] = await db.query(queryStr, [id, req.user.shop_id]);
    res.json(stockBreakdown);
  } catch (error) {
    console.error('Fetch warehouse stocks error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
