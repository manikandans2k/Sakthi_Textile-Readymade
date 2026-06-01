const db = require('../config/db');

// Helper to extract clean date range boundaries from query parameters
const getDateRange = (req) => {
  const { startDate, endDate } = req.query;
  
  // Default boundaries to the last 30 days if omitted
  const start = startDate 
    ? `${startDate} 00:00:00` 
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00';
  const end = endDate 
    ? `${endDate} 23:59:59` 
    : new Date().toISOString().split('T')[0] + ' 23:59:59';
    
  return { start, end };
};

// 1. Consolidated Sales Performance Report
exports.getSalesReport = async (req, res) => {
  const { start, end } = getDateRange(req);
  const shopId = req.user.shop_id;

  try {
    // Aggregations: Sales totals, averages, and payment method collections inside current shop
    const [summary] = await db.query(`
      SELECT 
        COUNT(id) as totalOrders,
        COALESCE(SUM(total_amount), 0) as subtotalSum,
        COALESCE(SUM(discount), 0) as discountSum,
        COALESCE(SUM(cgst_amount + sgst_amount), 0) as gstSum,
        COALESCE(SUM(net_amount), 0) as netRevenue,
        COALESCE(SUM(cash_amount), 0) as totalCash,
        COALESCE(SUM(card_amount), 0) as totalCard,
        COALESCE(SUM(upi_amount), 0) as totalUpi
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND shop_id = ?
    `, [start, end, shopId]);

    const stats = summary[0];
    const totalOrders = parseInt(stats.totalOrders) || 0;
    const netRevenue = parseFloat(stats.netRevenue) || 0;
    const averageOrderValue = totalOrders > 0 ? netRevenue / totalOrders : 0;

    // Transaction method splits
    const [methods] = await db.query(`
      SELECT 
        payment_method,
        COUNT(id) as count,
        COALESCE(SUM(net_amount), 0) as amount
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND shop_id = ?
      GROUP BY payment_method
    `, [start, end, shopId]);

    // Daily sales trend for graphical representation
    const [dailySales] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') as date,
        COUNT(id) as count,
        COALESCE(SUM(net_amount), 0) as revenue
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND shop_id = ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `, [start, end, shopId]);

    // Monthly sales trend for comparative dashboards
    const [monthlySales] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(id) as count,
        COALESCE(SUM(net_amount), 0) as revenue
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND shop_id = ?
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `, [start, end, shopId]);

    // Detailed sales ledger rows for table registers
    const [transactions] = await db.query(`
      SELECT 
        o.id,
        o.invoice_number,
        o.net_amount,
        o.payment_method,
        o.transaction_type,
        o.created_at,
        u.username as cashier_name,
        COALESCE(c.name, 'Walk-in Customer') as customer_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      ORDER BY o.created_at DESC
    `, [start, end, shopId]);

    res.json({
      summary: {
        totalOrders,
        subtotalSum: parseFloat(stats.subtotalSum),
        discountSum: parseFloat(stats.discountSum),
        gstSum: parseFloat(stats.gstSum),
        netRevenue,
        averageOrderValue,
        totalCashCollected: parseFloat(stats.totalCash),
        totalCardCollected: parseFloat(stats.totalCard),
        totalUpiCollected: parseFloat(stats.totalUpi)
      },
      paymentMethods: methods.map(m => ({ ...m, amount: parseFloat(m.amount) })),
      dailyTrend: dailySales.map(d => ({ ...d, revenue: parseFloat(d.revenue) })),
      monthlyTrend: monthlySales.map(m => ({ ...m, revenue: parseFloat(m.revenue) })),
      transactions: transactions.map(t => ({ ...t, net_amount: parseFloat(t.net_amount) }))
    });

  } catch (error) {
    console.error('Fetch sales report error:', error);
    res.status(500).json({ message: 'Internal server error compiles sales.' });
  }
};

// 2. Comprehensive GST Liability Ledger Reports
exports.getGstReport = async (req, res) => {
  const { start, end } = getDateRange(req);
  const shopId = req.user.shop_id;

  try {
    // Aggregated GST tax sums inside current shop
    const [summary] = await db.query(`
      SELECT 
        COUNT(id) as totalOrders,
        COALESCE(SUM(total_amount - discount), 0) as totalTaxableValue,
        COALESCE(SUM(cgst_amount), 0) as totalCgst,
        COALESCE(SUM(sgst_amount), 0) as totalSgst,
        COALESCE(SUM(cgst_amount + sgst_amount), 0) as totalGstCollected,
        COALESCE(SUM(net_amount), 0) as totalGrandTotal
      FROM orders
      WHERE created_at BETWEEN ? AND ? AND shop_id = ?
    `, [start, end, shopId]);

    // Detailed GST Invoice tax audit register
    const [invoices] = await db.query(`
      SELECT 
        o.id,
        o.invoice_number,
        o.created_at,
        o.total_amount as subtotal,
        o.discount,
        (o.total_amount - o.discount) as taxable_value,
        o.cgst_amount as cgst,
        o.sgst_amount as sgst,
        (o.cgst_amount + o.sgst_amount) as total_gst,
        o.net_amount as grand_total,
        COALESCE(c.name, 'Walk-in Customer') as customer_name,
        c.gst_number as customer_gstin
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      ORDER BY o.created_at DESC
    `, [start, end, shopId]);

    res.json({
      summary: {
        totalOrders: parseInt(summary[0].totalOrders) || 0,
        totalTaxableValue: parseFloat(summary[0].totalTaxableValue) || 0,
        totalCgst: parseFloat(summary[0].totalCgst) || 0,
        totalSgst: parseFloat(summary[0].totalSgst) || 0,
        totalGstCollected: parseFloat(summary[0].totalGstCollected) || 0,
        totalGrandTotal: parseFloat(summary[0].totalGrandTotal) || 0
      },
      invoices: invoices.map(inv => ({
        ...inv,
        subtotal: parseFloat(inv.subtotal),
        discount: parseFloat(inv.discount),
        taxable_value: parseFloat(inv.taxable_value),
        cgst: parseFloat(inv.cgst),
        sgst: parseFloat(inv.sgst),
        total_gst: parseFloat(inv.total_gst),
        grand_total: parseFloat(inv.grand_total)
      }))
    });

  } catch (error) {
    console.error('Fetch GST report error:', error);
    res.status(500).json({ message: 'Internal server error compiles GST.' });
  }
};

// 3. Stock Report (Inventory Counts, Warehouse Splits & Valuations)
exports.getStockReport = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    // Current stock levels per product variant and warehouse mapping inside current shop
    const [stockLevels] = await db.query(`
      SELECT 
        pv.id as product_id, -- Keep product_id label for frontend compatibility
        pv.barcode,
        CONCAT(p.product_name, ' - ', pv.size, ' (', pv.color, ')') as product_name,
        pv.sku,
        p.category,
        pv.selling_price as retail_price,
        pv.purchase_price as cost_price,
        pv.stock_qty as total_stock,
        'Pcs' as unit,
        COALESCE(pws.stock, 0) as warehouse_stock,
        w.name as warehouse_name
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      JOIN warehouses w ON w.shop_id = ?
      LEFT JOIN product_warehouse_stock pws ON pv.id = pws.variant_id AND w.id = pws.warehouse_id AND pws.shop_id = ?
      WHERE pv.shop_id = ?
      ORDER BY p.product_name ASC, pv.size ASC
    `, [shopId, shopId, shopId]);

    // Total aggregate inventory valuation summary (wholesale vs retail value)
    const [valuation] = await db.query(`
      SELECT 
        COALESCE(SUM(stock_qty * purchase_price), 0) as totalCostValue,
        COALESCE(SUM(stock_qty * selling_price), 0) as totalRetailValue,
        COALESCE(SUM(stock_qty), 0) as totalQuantity
      FROM product_variants
      WHERE shop_id = ?
    `, [shopId]);

    // Low stock warnings: Any variant aggregate inventory falling below 20 pieces
    const [lowStockAlerts] = await db.query(`
      SELECT 
        pv.id as product_id,
        CONCAT(p.product_name, ' - ', pv.size, ' (', pv.color, ')') as product_name,
        pv.sku,
        pv.stock_qty as stock,
        'Pcs' as unit
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.stock_qty < 20 AND pv.shop_id = ?
      ORDER BY pv.stock_qty ASC
    `, [shopId]);

    res.json({
      stockLevels: stockLevels.map(sl => ({
        ...sl,
        retail_price: parseFloat(sl.retail_price),
        cost_price: parseFloat(sl.cost_price),
        total_stock: parseInt(sl.total_stock),
        warehouse_stock: parseInt(sl.warehouse_stock)
      })),
      summary: {
        totalCostValue: parseFloat(valuation[0].totalCostValue) || 0,
        totalRetailValue: parseFloat(valuation[0].totalRetailValue) || 0,
        totalQuantity: parseInt(valuation[0].totalQuantity) || 0,
        alertCount: lowStockAlerts.length
      },
      lowStockAlerts: lowStockAlerts.map(la => ({
        ...la,
        stock: parseInt(la.stock)
      }))
    });

  } catch (error) {
    console.error('Fetch stock report error:', error);
    res.status(500).json({ message: 'Internal server error compiles stock.' });
  }
};

// 4. Profit Margin Analysis Reports (Base Wholesale Cost vs Final Taxable Revenue)
exports.getProfitAnalysis = async (req, res) => {
  const { start, end } = getDateRange(req);
  const shopId = req.user.shop_id;

  try {
    // Daily margin breakdown inside current shop
    const [dailyProfits] = await db.query(`
      SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as date,
        SUM(o.total_amount - o.discount) as net_revenue,
        SUM(cost_table.total_cost) as cost_basis,
        SUM((o.total_amount - o.discount) - cost_table.total_cost) as net_profit,
        CASE 
          WHEN SUM(o.total_amount - o.discount) > 0 
          THEN (SUM((o.total_amount - o.discount) - cost_table.total_cost) / SUM(o.total_amount - o.discount)) * 100 
          ELSE 0 
        END as margin_pct
      FROM orders o
      JOIN (
        SELECT ii.order_id, SUM(ii.qty * pv.purchase_price) as total_cost
        FROM invoice_items ii
        JOIN product_variants pv ON ii.variant_id = pv.id
        WHERE ii.shop_id = ?
        GROUP BY ii.order_id
      ) cost_table ON o.id = cost_table.order_id
      WHERE o.transaction_type = 'Sale' AND o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
      ORDER BY date ASC
    `, [shopId, start, end, shopId]);

    // Product variant profitability scoreboards
    const [productProfits] = await db.query(`
      SELECT 
        CONCAT(p.product_name, ' - ', pv.size, ' (', pv.color, ')') as product_name,
        pv.sku,
        p.category,
        SUM(ii.qty) as quantity_sold,
        SUM(ii.total) as gross_revenue,
        SUM(ii.qty * pv.purchase_price) as cost_basis,
        SUM(ii.total - (ii.qty * pv.purchase_price)) as net_profit,
        CASE 
          WHEN SUM(ii.total) > 0 
          THEN (SUM(ii.total - (ii.qty * pv.purchase_price)) / SUM(ii.total)) * 100 
          ELSE 0 
        END as margin_pct
      FROM invoice_items ii
      JOIN product_variants pv ON ii.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN orders o ON ii.order_id = o.id
      WHERE o.transaction_type = 'Sale' AND o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      GROUP BY pv.id
      ORDER BY net_profit DESC
    `, [start, end, shopId]);

    // Net Summary calculations
    let totalRevenueSum = 0;
    let totalCostSum = 0;
    let totalProfitSum = 0;

    dailyProfits.forEach(dp => {
      totalRevenueSum += parseFloat(dp.net_revenue) || 0;
      totalCostSum += parseFloat(dp.cost_basis) || 0;
      totalProfitSum += parseFloat(dp.net_profit) || 0;
    });

    const averageMarginPct = totalRevenueSum > 0 ? (totalProfitSum / totalRevenueSum) * 100 : 0;

    res.json({
      summary: {
        totalRevenue: totalRevenueSum,
        totalCostBasis: totalCostSum,
        netProfit: totalProfitSum,
        averageMarginPct
      },
      dailyProfits: dailyProfits.map(dp => ({
        ...dp,
        net_revenue: parseFloat(dp.net_revenue),
        cost_basis: parseFloat(dp.cost_basis),
        net_profit: parseFloat(dp.net_profit),
        margin_pct: parseFloat(dp.margin_pct)
      })),
      productProfits: productProfits.map(pp => ({
        ...pp,
        quantity_sold: parseInt(pp.quantity_sold),
        gross_revenue: parseFloat(pp.gross_revenue),
        cost_basis: parseFloat(pp.cost_basis),
        net_profit: parseFloat(pp.net_profit),
        margin_pct: parseFloat(pp.margin_pct)
      }))
    });

  } catch (error) {
    console.error('Fetch profit report error:', error);
    res.status(500).json({ message: 'Internal server error compiles profits.' });
  }
};

// 5. Inventory Movement Ledger (Fast-Moving vs Dead Stock)
exports.getInventoryMovement = async (req, res) => {
  const { start, end } = getDateRange(req);
  const shopId = req.user.shop_id;

  try {
    // Fast-Moving Products ranked by overall pieces volume
    const [fastMoving] = await db.query(`
      SELECT 
        CONCAT(p.product_name, ' - ', pv.size, ' (', pv.color, ')') as product_name,
        pv.sku,
        p.category,
        SUM(ii.qty) as total_quantity,
        SUM(ii.total) as total_sales,
        'Pcs' as unit
      FROM invoice_items ii
      JOIN product_variants pv ON ii.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN orders o ON ii.order_id = o.id
      WHERE o.transaction_type = 'Sale' AND o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      GROUP BY pv.id
      ORDER BY total_quantity DESC
      LIMIT 10
    `, [start, end, shopId]);

    // Dead Stock: Products with stock > 0 but exactly 0 sale transactions logged in the past 90 days
    const [deadStock] = await db.query(`
      SELECT 
        pv.id as product_id,
        CONCAT(p.product_name, ' - ', pv.size, ' (', pv.color, ')') as product_name,
        pv.sku,
        p.category,
        pv.selling_price as retail_price,
        pv.stock_qty as current_stock,
        'Pcs' as unit,
        COALESCE(MAX(o.created_at), 'Never') as last_sold_date
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN invoice_items ii ON pv.id = ii.variant_id AND ii.shop_id = ?
      LEFT JOIN orders o ON ii.order_id = o.id AND o.transaction_type = 'Sale' AND o.shop_id = ?
      WHERE pv.shop_id = ? AND pv.id NOT IN (
        SELECT DISTINCT ii.variant_id
        FROM invoice_items ii
        JOIN orders o ON ii.order_id = o.id
        WHERE o.transaction_type = 'Sale' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND o.shop_id = ?
      )
      GROUP BY pv.id
      HAVING current_stock > 0
      ORDER BY current_stock DESC
    `, [shopId, shopId, shopId, shopId]);

    res.json({
      fastMoving: fastMoving.map(fm => ({
        ...fm,
        total_quantity: parseInt(fm.total_quantity),
        total_sales: parseFloat(fm.total_sales)
      })),
      deadStock: deadStock.map(ds => ({
        ...ds,
        retail_price: parseFloat(ds.retail_price),
        current_stock: parseInt(ds.current_stock)
      }))
    });

  } catch (error) {
    console.error('Fetch inventory movement error:', error);
    res.status(500).json({ message: 'Internal server error compiles movements.' });
  }
};

// 6. Cashier Performance Scores
exports.getCashierPerformance = async (req, res) => {
  const { start, end } = getDateRange(req);
  const shopId = req.user.shop_id;

  try {
    const [cashiers] = await db.query(`
      SELECT 
        u.username as cashier_name,
        COUNT(DISTINCT CASE WHEN o.transaction_type = 'Sale' THEN o.id END) as sales_count,
        COALESCE(SUM(CASE WHEN o.transaction_type = 'Sale' THEN o.net_amount ELSE 0 END), 0) as total_sales_amount,
        COUNT(DISTINCT CASE WHEN o.transaction_type = 'Return' THEN o.id END) as returns_count,
        COALESCE(SUM(CASE WHEN o.transaction_type = 'Return' THEN o.net_amount ELSE 0 END), 0) as total_returns_amount,
        COALESCE(SUM(o.net_amount), 0) as net_amount,
        CASE 
          WHEN COUNT(DISTINCT CASE WHEN o.transaction_type = 'Sale' THEN o.id END) > 0 
          THEN COALESCE(SUM(CASE WHEN o.transaction_type = 'Sale' THEN o.net_amount ELSE 0 END), 0) / COUNT(DISTINCT CASE WHEN o.transaction_type = 'Sale' THEN o.id END)
          ELSE 0 
        END as average_ticket_size
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.created_at BETWEEN ? AND ? AND o.shop_id = ?
      WHERE u.shop_id = ?
      GROUP BY u.id
      ORDER BY total_sales_amount DESC
    `, [start, end, shopId, shopId]);

    res.json(cashiers.map(c => ({
      ...c,
      sales_count: parseInt(c.sales_count),
      total_sales_amount: parseFloat(c.total_sales_amount),
      returns_count: parseInt(c.returns_count),
      total_returns_amount: parseFloat(c.total_returns_amount),
      net_amount: parseFloat(c.net_amount),
      average_ticket_size: parseFloat(c.average_ticket_size)
    })));

  } catch (error) {
    console.error('Fetch cashier performance error:', error);
    res.status(500).json({ message: 'Internal server error compiles cashiers.' });
  }
};

// 7. Customer Loyalty and Lifetime Value Analytics
exports.getCustomerAnalytics = async (req, res) => {
  const shopId = req.user.shop_id;
  try {
    const [customers] = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.phone,
        c.email,
        c.gst_number,
        c.loyalty_points,
        c.credit_balance,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.net_amount), 0) as clv_amount,
        COALESCE(MAX(o.created_at), 'Never') as last_purchase_date
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id AND o.transaction_type = 'Sale' AND o.shop_id = ?
      WHERE c.shop_id = ?
      GROUP BY c.id
      ORDER BY clv_amount DESC
    `, [shopId, shopId]);

    res.json(customers.map(cust => ({
      ...cust,
      loyalty_points: parseInt(cust.loyalty_points),
      credit_balance: parseFloat(cust.credit_balance),
      total_orders: parseInt(cust.total_orders),
      clv_amount: parseFloat(cust.clv_amount)
    })));

  } catch (error) {
    console.error('Fetch customer analytics error:', error);
    res.status(500).json({ message: 'Internal server error compiles customers.' });
  }
};
