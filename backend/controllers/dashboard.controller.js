const db = require('../config/db');

exports.getStats = async (req, res) => {
  const shopId = req.user.shop_id;

  try {
    // 1. Today's Revenue and Sales Count
    const [todayStats] = await db.query(`
      SELECT 
        COALESCE(SUM(net_amount), 0) as todayRevenue,
        COUNT(id) as todaySalesCount
      FROM orders 
      WHERE DATE(created_at) = CURDATE() AND shop_id = ?
    `, [shopId]);

    // 2. Total unique product variants in system and total stock sum
    const [inventoryStats] = await db.query(`
      SELECT 
        COUNT(id) as totalProductsCount,
        COALESCE(SUM(stock_qty), 0) as totalStockUnits
      FROM product_variants
      WHERE shop_id = ?
    `, [shopId]);

    // 3. Low stock items (stock < 10)
    const [lowStock] = await db.query(`
      SELECT pv.id, p.product_name AS name, pv.sku, pv.stock_qty AS stock, p.category, 'Pcs' AS unit, pv.selling_price AS price
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.stock_qty < 10 AND pv.shop_id = ?
      ORDER BY pv.stock_qty ASC
      LIMIT 10
    `, [shopId]);

    // 4. Category-wise sales distribution (for charts)
    const [categorySales] = await db.query(`
      SELECT 
        p.category, 
        COALESCE(SUM(ii.qty), 0) as totalQuantitySold,
        COALESCE(SUM(ii.total), 0) as totalCategorySales
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN invoice_items ii ON pv.id = ii.variant_id
      WHERE p.shop_id = ?
      GROUP BY p.category
      ORDER BY totalCategorySales DESC
    `, [shopId]);

    // 5. Recent 5 orders
    const [recentOrders] = await db.query(`
      SELECT o.id, o.invoice_number, o.net_amount, o.payment_method, o.created_at, u.username as cashier_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.shop_id = ?
      ORDER BY o.created_at DESC
      LIMIT 5
    `, [shopId]);

    // 6. Last 7 Days Sales Trend (for charts)
    const [salesTrend] = await db.query(`
      SELECT 
        DATE_FORMAT(d.date, '%Y-%m-%d') as date,
        COALESCE(SUM(o.net_amount), 0) as totalSales
      FROM (
        SELECT CURDATE() as date UNION ALL
        SELECT CURDATE() - INTERVAL 1 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 2 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 3 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 4 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 5 DAY UNION ALL
        SELECT CURDATE() - INTERVAL 6 DAY
      ) d
      LEFT JOIN orders o ON DATE(o.created_at) = d.date AND o.shop_id = ?
      GROUP BY d.date
      ORDER BY d.date ASC
    `, [shopId]);

    res.json({
      todayRevenue: parseFloat(todayStats[0].todayRevenue) || 0,
      todaySalesCount: parseInt(todayStats[0].todaySalesCount) || 0,
      totalProductsCount: parseInt(inventoryStats[0].totalProductsCount) || 0,
      totalStockUnits: parseInt(inventoryStats[0].totalStockUnits) || 0,
      lowStock: lowStock.map(row => ({
        ...row,
        price: parseFloat(row.price),
        stock: parseInt(row.stock)
      })),
      categorySales: categorySales.map(row => ({
        ...row,
        totalQuantitySold: parseInt(row.totalQuantitySold),
        totalCategorySales: parseFloat(row.totalCategorySales)
      })),
      recentOrders: recentOrders.map(row => ({
        ...row,
        net_amount: parseFloat(row.net_amount)
      })),
      salesTrend: salesTrend.map(row => ({
        ...row,
        totalSales: parseFloat(row.totalSales)
      }))
    });

  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};
