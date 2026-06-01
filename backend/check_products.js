const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnose() {
  console.log('Connecting to database:', process.env.DB_NAME || 'textile_pos_erp');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'textile_pos_erp'
    });

    console.log('Connected successfully!');

    // 1. Check shops
    const [shops] = await connection.query('SELECT * FROM shops');
    console.log('\n--- Shops ---');
    console.log(shops);

    // 2. Check users
    const [users] = await connection.query('SELECT id, username, role, shop_id FROM users');
    console.log('\n--- Users ---');
    console.log(users);

    // 3. Check products
    const [productsCount] = await connection.query('SELECT COUNT(*) as count FROM products');
    console.log('\n--- Products Count ---');
    console.log(productsCount[0].count);

    // 4. Check product variants
    const [variants] = await connection.query('SELECT id, product_id, shop_id, barcode, sku, selling_price, stock_qty FROM product_variants LIMIT 5');
    console.log('\n--- Product Variants (Sample) ---');
    console.log(variants);

    await connection.end();
  } catch (err) {
    console.error('Diagnostic error:', err);
  }
}

diagnose();
