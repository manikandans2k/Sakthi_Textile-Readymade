const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function runRepair() {
  console.log('Connecting to database:', process.env.DB_NAME);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'textile_pos_erp'
    });

    console.log('Successfully connected!');

    // Repair / sync standard password hashes for the default accounts
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    const cashierHash = await bcrypt.hash('cashier123', 10);
    const stockHash = await bcrypt.hash('stock123', 10);

    console.log('Updating password hashes...');
    await connection.query("UPDATE users SET password_hash = ? WHERE username = 'admin'", [adminHash]);
    await connection.query("UPDATE users SET password_hash = ? WHERE username = 'manager'", [managerHash]);
    await connection.query("UPDATE users SET password_hash = ? WHERE username = 'cashier'", [cashierHash]);
    await connection.query("UPDATE users SET password_hash = ?, role = 'Stock Manager' WHERE username = 'stock'", [stockHash]);

    console.log('Updates completed. Verifying results...');

    const [rows] = await connection.query('SELECT id, username, password_hash, role FROM users');
    console.log('--- Verified Users in DB ---');
    for (const r of rows) {
      const match123 = await bcrypt.compare(r.username + '123', r.password_hash);
      console.log(`User: ${r.username} | Role: ${r.role}`);
      console.log(`  Hash: ${r.password_hash}`);
      console.log(`  Matches "${r.username}123": ${match123}`);
    }

    await connection.end();
  } catch (err) {
    console.error('Error running diagnostics/repair:', err);
  }
}

runRepair();
