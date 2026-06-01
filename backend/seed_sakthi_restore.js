const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'textile_pos_erp'
  });

  try {
    console.log('Checking if shop Sakthi readymade exists...');
    const [existingShops] = await connection.query("SELECT id FROM shops WHERE email = 'sakthi@yopmail.com'");
    
    let shopId;
    if (existingShops.length === 0) {
      console.log('Inserting Sakthi readymade shop...');
      const [shopResult] = await connection.query(`
        INSERT INTO shops (shop_name, owner_name, mobile, email, gst_number, address, subscription_plan, subscription_expiry, status)
        VALUES ('Sakthi readymade', 'Sakthi', '9898978789', 'sakthi@yopmail.com', '27ABCDE9999A1Z1', 'Garment Bazaar Road', 'Professional', DATE_ADD(NOW(), INTERVAL 1 YEAR), 'Active')
      `);
      shopId = shopResult.insertId;
      console.log(`Created shop with ID: ${shopId}`);
      
      // Also seed a default warehouse for Sakthi Readymade
      await connection.query(`
        INSERT INTO warehouses (shop_id, name, location, capacity)
        VALUES (?, 'Main Warehouse', 'Default Central Depot', 10000)
      `, [shopId]);
      console.log('Created default warehouse for Sakthi readymade.');
    } else {
      shopId = existingShops[0].id;
      console.log(`Shop already exists with ID: ${shopId}`);
    }

    console.log('Checking if user sakthi exists...');
    const [existingUsers] = await connection.query("SELECT id FROM users WHERE username = 'sakthi'");
    
    if (existingUsers.length === 0) {
      console.log('Hashing password for sakthi...');
      const passwordHash = await bcrypt.hash('Testing@123', 10);
      
      console.log('Getting Shop Owner role ID...');
      const [roles] = await connection.query("SELECT id FROM roles WHERE role_name = 'Shop Owner'");
      if (roles.length === 0) {
        throw new Error('Shop Owner role not found in database.');
      }
      const roleId = roles[0].id;

      console.log('Inserting user sakthi...');
      await connection.query(`
        INSERT INTO users (username, password_hash, role_id, shop_id, status, permissions)
        VALUES ('sakthi', ?, ?, ?, 'Active', 'billing,products,inventory,reports')
      `, [passwordHash, roleId, shopId]);
      console.log('User sakthi seeded successfully!');
    } else {
      console.log('User sakthi already exists.');
    }
  } catch (err) {
    console.error('Error during seeding:', err.message);
  } finally {
    await connection.end();
  }
}

seed();
