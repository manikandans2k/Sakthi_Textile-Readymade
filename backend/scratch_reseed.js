const mysql = require('mysql2/promise');
require('dotenv').config();

async function reseed() {
  console.log('Resetting database textile_pos_erp...');
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    const dbName = process.env.DB_NAME || 'textile_pos_erp';
    console.log(`Dropping database \`${dbName}\`...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
    await connection.end();
    console.log('Database dropped.');

    // Now run backend initializeDatabase to recreate and seed from scratch!
    const db = require('./config/db');
    console.log('Initializing database from scratch...');
    await db.initializeDatabase();
    console.log('Database re-initialization and seeding completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error reseeding database:', err);
    process.exit(1);
  }
}

reseed();
