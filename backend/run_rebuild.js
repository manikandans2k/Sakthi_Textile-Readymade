const db = require('./config/db');

async function rebuild() {
  console.log('Starting manual database rebuild and seeding...');
  try {
    const pool = db.getPool();
    
    // Explicitly drop all tables to force recreation
    console.log('Dropping existing tables to force full multi-tenant seed...');
    await db.query("SET FOREIGN_KEY_CHECKS = 0;");
    const tablesToDrop = [
      'audit_logs', 'order_items', 'invoice_items', 'orders', 'stock_ledger',
      'product_warehouse_stock', 'customer_ledger', 'supplier_ledger', 'suppliers',
      'warehouses', 'product_variants', 'products', 'customers', 'users', 'shops'
    ];
    for (const table of tablesToDrop) {
      await db.query(`DROP TABLE IF EXISTS \`${table}\`;`);
    }
    await db.query("SET FOREIGN_KEY_CHECKS = 1;");
    console.log('Tables dropped successfully.');

    // Initialize database (this will recreate tables and run the seeder)
    await db.initializeDatabase();
    console.log('Database manual rebuild and seeding completed successfully!');
    
    process.exit(0);
  } catch (err) {
    console.error('Error during manual database rebuild:', err);
    process.exit(1);
  }
}

rebuild();
