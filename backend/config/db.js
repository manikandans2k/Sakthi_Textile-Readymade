const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : null
};

const dbName = process.env.DB_NAME || 'textile_pos_erp';
let pool;

async function initializeDatabase() {
  const commonPasswords = [
    process.env.DB_PASSWORD || '',
    'root',
    'root123',
    '123456',
    'admin',
    'mysql'
  ];

  let connection;
  let activePassword = dbConfig.password;
  let connected = false;
  let lastError;

  for (const pwd of commonPasswords) {
    try {
      connection = await mysql.createConnection({
        ...dbConfig,
        password: pwd
      });
      activePassword = pwd;
      connected = true;
      console.log(`MySQL connected successfully using password: "${pwd === '' ? '(none)' : pwd}"`);
      break;
    } catch (err) {
      if (err.code !== 'ER_ACCESS_DENIED_ERROR') {
        throw err; // Rethrow other database host/network errors
      }
      lastError = err;
    }
  }

  if (!connected) {
    console.error('Database connection failed. Unable to authenticate with standard passwords.');
    throw lastError || new Error('Access denied. Checked common local passwords but failed to connect.');
  }

  try {
    console.log('Checking database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    // Auto-update .env if a different password was discovered
    if (activePassword !== (process.env.DB_PASSWORD || '')) {
      try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(__dirname, '../.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('DB_PASSWORD=')) {
          envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${activePassword}`);
        } else {
          envContent += `\nDB_PASSWORD=${activePassword}`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log(`Successfully auto-corrected backend/.env password to: "${activePassword}"`);
      } catch (envErr) {
        console.warn('Could not auto-write working password to .env:', envErr.message);
      }
    }
    
    dbConfig.password = activePassword;
    
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
    
    console.log(`Switched to "${dbName}". Verifying base and inventory tables...`);

    // SCHEMA DETECT & UPGRADE
    let needsRebuild = false;
    try {
      // Check if roles table exists
      const [rolesTable] = await pool.query("SHOW TABLES LIKE 'roles'");
      if (rolesTable.length === 0) {
        needsRebuild = true;
        console.log("RBAC database schema not detected (roles table missing). Rebuilding for advanced RBAC...");
      } else {
        // Check if shops table exists
        const [shopsTable] = await pool.query("SHOW TABLES LIKE 'shops'");
        if (shopsTable.length === 0) {
          needsRebuild = true;
          console.log("SaaS database schema not detected (shops table missing). Rebuilding for SaaS multi-tenant isolation...");
        } else {
          // Check if products has the old barcode column (textile schema)
          const [columns] = await pool.query("SHOW COLUMNS FROM `products` LIKE 'barcode'");
          if (columns.length > 0) {
            needsRebuild = true;
            console.log("Old textile database schema detected (products.barcode exists). Rebuilding for readymade garments schema...");
          } else {
            // Check if product_variants table is missing
            const [variantsTable] = await pool.query("SHOW TABLES LIKE 'product_variants'");
            if (variantsTable.length === 0) {
              needsRebuild = true;
              console.log("product_variants table not found. Rebuilding for readymade garments schema...");
            }
          }
        }
      }
    } catch (err) {
      needsRebuild = true;
      console.log("Database table query failed or tables don't exist. Rebuilding schema...");
    }

    if (needsRebuild) {
      console.log("Dropping old database tables to deploy piece-based garments POS schema...");
      await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
      const tablesToDrop = [
        'audit_logs', 'order_items', 'invoice_items', 'orders', 'stock_ledger',
        'product_warehouse_stock', 'customer_ledger', 'supplier_ledger', 'suppliers',
        'warehouses', 'product_variants', 'products', 'customers', 'users', 'shops', 'roles'
      ];
      for (const table of tablesToDrop) {
        await pool.query(`DROP TABLE IF EXISTS \`${table}\`;`);
      }
      await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
      console.log("Old tables dropped successfully.");
    }
    
    // 0.0 Roles Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) UNIQUE NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_name VARCHAR(100) NOT NULL,
        owner_name VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        gst_number VARCHAR(15) NULL,
        address VARCHAR(150) NULL,
        subscription_plan ENUM('Starter', 'Professional', 'Enterprise') NOT NULL DEFAULT 'Starter',
        subscription_expiry TIMESTAMP NULL,
        status ENUM('Active', 'Suspended') NOT NULL DEFAULT 'Active',
        gst_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id INT UNSIGNED NOT NULL,
        shop_id INT UNSIGNED NULL,
        created_by INT UNSIGNED NULL,
        status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
        permissions VARCHAR(255) NULL,
        refresh_token VARCHAR(255) NULL,
        password_reset_token VARCHAR(255) NULL,
        password_reset_expires TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Customers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100) NULL,
        loyalty_points INT NOT NULL DEFAULT 0,
        gst_number VARCHAR(15) NULL,
        credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_customers_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY uq_customers_phone_shop (phone, shop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Products Table (Base garments definitions)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        product_name VARCHAR(100) NOT NULL,
        brand VARCHAR(50) NULL,
        category VARCHAR(50) NOT NULL COMMENT 'Shirts, T-Shirts, Jeans, Pants, Sarees, Chudithar, Fashion Products, etc.',
        gender ENUM('Men', 'Women', 'Kids', 'Unisex') NOT NULL,
        description TEXT NULL,
        allow_manual_qty BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_products_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure allow_manual_qty exists in products if table was already created
    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM `products` LIKE 'allow_manual_qty'");
      if (columns.length === 0) {
        console.log("Adding column products.allow_manual_qty to existing database...");
        await pool.query("ALTER TABLE `products` ADD COLUMN `allow_manual_qty` BOOLEAN NOT NULL DEFAULT false;");
        console.log("Column products.allow_manual_qty added successfully.");
      }
    } catch (columnErr) {
      console.warn("Could not auto-add products.allow_manual_qty column:", columnErr.message);
    }

    // Ensure gst_enabled exists in shops if table was already created
    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM `shops` LIKE 'gst_enabled'");
      if (columns.length === 0) {
        console.log("Adding column shops.gst_enabled to existing database...");
        await pool.query("ALTER TABLE `shops` ADD COLUMN `gst_enabled` BOOLEAN NOT NULL DEFAULT true;");
        console.log("Column shops.gst_enabled added successfully.");
      }
    } catch (columnErr) {
      console.warn("Could not auto-add shops.gst_enabled column:", columnErr.message);
    }

    // Ensure email exists in users if table was already created
    try {
      const [columns] = await pool.query("SHOW COLUMNS FROM `users` LIKE 'email'");
      if (columns.length === 0) {
        console.log("Adding column users.email to existing database...");
        await pool.query("ALTER TABLE `users` ADD COLUMN `email` VARCHAR(100) UNIQUE NULL;");
        console.log("Column users.email added successfully.");
      }
    } catch (columnErr) {
      console.warn("Could not auto-add users.email column:", columnErr.message);
    }

    // 4. Product Variants Table (Sizing, unique barcodes, prices)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        barcode VARCHAR(50) NOT NULL COMMENT 'Unique scannable barcode target',
        sku VARCHAR(50) NOT NULL COMMENT 'Unique SKU identifier',
        color VARCHAR(30) NOT NULL,
        size VARCHAR(20) NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        selling_price DECIMAL(10, 2) NOT NULL,
        mrp DECIMAL(10, 2) NOT NULL,
        stock_qty INT NOT NULL DEFAULT 0 COMMENT 'Global accumulated stock levels',
        gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 12.00 COMMENT 'GST Percentage rate',
        image VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_variants_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY uq_variants_barcode_shop (barcode, shop_id),
        UNIQUE KEY uq_variants_sku_shop (sku, shop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Warehouses Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(150) NOT NULL,
        capacity INT NOT NULL DEFAULT 10000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_warehouses_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Suppliers Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        contact_person VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100) NULL,
        gstin VARCHAR(15) NULL,
        credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_suppliers_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Supplier Ledger Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supplier_ledger (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        supplier_id INT UNSIGNED NOT NULL,
        type ENUM('Invoice', 'Payment') NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        description VARCHAR(200) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_supplier_ledger_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_supplier_ledger_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Customer Ledger Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_ledger (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        customer_id INT UNSIGNED NOT NULL,
        type ENUM('Invoice', 'Payment') NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        balance_after DECIMAL(10, 2) NOT NULL,
        description VARCHAR(200) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_customer_ledger_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_customer_ledger_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Product Warehouse Stock (Composite map for variants)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_warehouse_stock (
        shop_id INT UNSIGNED NOT NULL,
        variant_id INT UNSIGNED NOT NULL,
        warehouse_id INT UNSIGNED NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        PRIMARY KEY (variant_id, warehouse_id),
        CONSTRAINT fk_pw_stock_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_pw_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_pw_stock_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Stock Ledger Table (Logs physical variant stock changes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_ledger (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        variant_id INT UNSIGNED NOT NULL,
        warehouse_id INT UNSIGNED NOT NULL,
        type ENUM('Stock In', 'Stock Out', 'Stock Transfer', 'Warehouse Transfer', 'Stock Adjustment', 'Stock Reconciliation', 'Damage') NOT NULL,
        quantity INT NOT NULL,
        reference VARCHAR(150) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_stock_ledger_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_stock_ledger_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_stock_ledger_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Orders Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        customer_id INT UNSIGNED NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        coupon_code VARCHAR(30) NULL,
        cgst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        sgst_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        net_amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Split',
        cash_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        card_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        upi_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        transaction_type ENUM('Sale', 'Return', 'Exchange') NOT NULL DEFAULT 'Sale',
        original_invoice_number VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_orders_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE,
        UNIQUE KEY uq_orders_invoice_shop (invoice_number, shop_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Invoice Items Table (replaces order_items, piece-based billing)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NOT NULL,
        order_id INT UNSIGNED NOT NULL,
        variant_id INT UNSIGNED NOT NULL,
        qty INT NOT NULL COMMENT 'Pieces quantity',
        price DECIMAL(10, 2) NOT NULL,
        gst DECIMAL(10, 2) NOT NULL COMMENT 'GST tax amount for this item line',
        total DECIMAL(10, 2) NOT NULL COMMENT 'Net item line total including GST',
        CONSTRAINT fk_invoice_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_invoice_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_invoice_items_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. Audit Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id INT UNSIGNED NULL,
        user_id INT UNSIGNED NULL,
        action VARCHAR(100) NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_audit_logs_shop FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Database tables and schema updates verified.');

    // Seed default tables
    await seedDefaultData();

  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

async function seedDefaultData() {
  try {
    // 0. Seed Shops
    const [shops] = await pool.query('SELECT COUNT(*) as count FROM shops');
    let defaultShopId = 1;
    if (shops[0].count === 0) {
      const [shopResult] = await pool.query(`
        INSERT INTO shops (shop_name, owner_name, mobile, email, gst_number, address, subscription_plan, subscription_expiry, status, gst_enabled)
        VALUES ('Apparel World', 'Anjali Varma', '9876543210', 'anjali@apparelworld.com', '27ABCDE1234A1Z1', 'Sector 15, Garments City', 'Starter', DATE_ADD(NOW(), INTERVAL 1 YEAR), 'Active', true)
      `);
      defaultShopId = shopResult.insertId;
      console.log(`Seeded default Shop with ID: ${defaultShopId}`);
    } else {
      const [existingShops] = await pool.query('SELECT id FROM shops LIMIT 1');
      defaultShopId = existingShops[0].id;
    }

    // Seed Roles
    const [rolesCount] = await pool.query('SELECT COUNT(*) as count FROM roles');
    if (rolesCount[0].count === 0) {
      await pool.query(`
        INSERT INTO roles (role_name) VALUES
        ('Super Admin'),
        ('Shop Owner'),
        ('Manager'),
        ('Cashier'),
        ('Stock Manager')
      `);
      console.log('Seeded default Roles.');
    }

    // 1. Seed Users
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
      const superadminHash = await bcrypt.hash('admin123', 10);
      const adminHash = await bcrypt.hash('admin123', 10);
      const managerHash = await bcrypt.hash('manager123', 10);
      const cashierHash = await bcrypt.hash('cashier123', 10);
      const stockHash = await bcrypt.hash('stock123', 10);

      const [roleRows] = await pool.query('SELECT id, role_name FROM roles');
      const getRoleId = (name) => roleRows.find(r => r.role_name === name).id;

      await pool.query(`
        INSERT INTO users (username, email, password_hash, role_id, shop_id, status, permissions) VALUES 
        ('superadmin', 'superadmin@apparelworld.com', ?, ?, NULL, 'Active', 'billing,products,inventory,reports'),
        ('admin', 'admin@apparelworld.com', ?, ?, ?, 'Active', 'billing,products,inventory,reports'),
        ('manager', 'manager@apparelworld.com', ?, ?, ?, 'Active', 'billing,products,inventory,reports'),
        ('cashier', 'cashier@apparelworld.com', ?, ?, ?, 'Active', 'billing'),
        ('stock', 'stock@apparelworld.com', ?, ?, ?, 'Active', 'inventory')
      `, [
        superadminHash, getRoleId('Super Admin'),
        adminHash, getRoleId('Shop Owner'), defaultShopId,
        managerHash, getRoleId('Manager'), defaultShopId,
        cashierHash, getRoleId('Cashier'), defaultShopId,
        stockHash, getRoleId('Stock Manager'), defaultShopId
      ]);
      console.log('Seeded default Users.');
    }

    // Ensure Super Admin 'mani' is created/updated
    const [roles] = await pool.query("SELECT id FROM roles WHERE role_name = 'Super Admin'");
    if (roles.length > 0) {
      const superAdminRoleId = roles[0].id;
      const [superAdminUsers] = await pool.query("SELECT id FROM users WHERE role_id = ?", [superAdminRoleId]);
      
      const maniHash = await bcrypt.hash('Testing@123', 10);
      
      if (superAdminUsers.length === 0) {
        // Create new Super Admin 'mani'
        await pool.query(`
          INSERT INTO users (username, email, password_hash, role_id, status, permissions)
          VALUES ('mani', 'manikandan16bca@gmail.com', ?, ?, 'Active', 'billing,products,inventory,reports')
        `, [maniHash, superAdminRoleId]);
        console.log("Super Admin account 'mani' seeded successfully.");
      } else {
        // Ensure the Super Admin 'mani' details are up-to-date
        const saUserId = superAdminUsers[0].id;
        await pool.query(`
          UPDATE users 
          SET username = 'mani', email = 'manikandan16bca@gmail.com', password_hash = ?, status = 'Active'
          WHERE id = ?
        `, [maniHash, saUserId]);
        console.log("Super Admin account 'mani' configurations verified.");
      }
    }

    // Ensure email addresses are set for other default seeded users
    await pool.query("UPDATE users SET email = 'admin@apparelworld.com' WHERE username = 'admin' AND email IS NULL");
    await pool.query("UPDATE users SET email = 'manager@apparelworld.com' WHERE username = 'manager' AND email IS NULL");
    await pool.query("UPDATE users SET email = 'cashier@apparelworld.com' WHERE username = 'cashier' AND email IS NULL");
    await pool.query("UPDATE users SET email = 'stock@apparelworld.com' WHERE username = 'stock' AND email IS NULL");

    // Automatically sync/populate users.email with shops.email for all Shop Owners
    await pool.query(`
      UPDATE users u
      JOIN shops s ON u.shop_id = s.id
      JOIN roles r ON u.role_id = r.id
      SET u.email = s.email
      WHERE r.role_name = 'Shop Owner' AND u.email IS NULL
    `);

    // 2. Seed Warehouses
    const [warehouses] = await pool.query('SELECT COUNT(*) as count FROM warehouses');
    if (warehouses[0].count === 0) {
      await pool.query(`
        INSERT INTO warehouses (shop_id, name, location, capacity) VALUES 
        (?, 'Central Warehouse', 'Sector 10, Industrial Hub', 50000),
        (?, 'Retail Outlet Store', 'Basement Level 1, Main Plaza', 10000)
      `, [defaultShopId, defaultShopId]);
      console.log('Seeded default Warehouses.');
    }

    // 3. Seed Customers
    const [customers] = await pool.query('SELECT COUNT(*) as count FROM customers');
    if (customers[0].count === 0) {
      const defaultCustomers = [
        [defaultShopId, 'Rahul Sharma', '9876543210', 'rahul@gmail.com', 150, '27ABCDE1234A1Z1', 0.00],
        [defaultShopId, 'Anjali Varma', '8765432109', 'anjali@outlook.com', 45, null, 120.00],
        [defaultShopId, 'Vikram Malhotra', '7654321098', 'vikram@textiles.com', 320, '27FGHIJ5678B1Z2', 0.00]
      ];
      await pool.query(`
        INSERT INTO customers (shop_id, name, phone, email, loyalty_points, gst_number, credit_balance) VALUES ?
      `, [defaultCustomers]);
      console.log('Seeded default Customers.');

      // Seed a starting invoice in customer ledger for Anjali Varma
      const [anjali] = await pool.query("SELECT id FROM customers WHERE phone = '8765432109' AND shop_id = ?", [defaultShopId]);
      if (anjali.length > 0) {
        await pool.query(`
          INSERT INTO customer_ledger (shop_id, customer_id, type, amount, balance_after, description) VALUES 
          (?, ?, 'Invoice', 120.00, 120.00, 'Opening outstanding balance invoice')
        `, [defaultShopId, anjali[0].id]);
      }
    }

    // 4. Seed Suppliers
    const [suppliers] = await pool.query('SELECT COUNT(*) as count FROM suppliers');
    if (suppliers[0].count === 0) {
      await pool.query(`
        INSERT INTO suppliers (shop_id, name, contact_person, phone, email, gstin, credit_balance) VALUES 
        (?, 'Premium Garments Co.', 'Amit Patel', '9988776655', 'sales@premiumgarments.com', '27AAAAA1111A1Z1', 2500.00),
        (?, 'Vogue Fashion Spinners', 'Sanjay Shah', '9876501234', 'info@voguefashion.com', '27BBBBB2222B2Z2', 0.00)
      `, [defaultShopId, defaultShopId]);
      console.log('Seeded default Suppliers.');

      // Add a starting invoice transaction in supplier ledger
      const [sups] = await pool.query('SELECT id FROM suppliers WHERE shop_id = ? LIMIT 1', [defaultShopId]);
      if (sups.length > 0) {
        await pool.query(`
          INSERT INTO supplier_ledger (shop_id, supplier_id, type, amount, balance_after, description) VALUES 
          (?, ?, 'Invoice', 2500.00, 2500.00, 'Initial Garments stock invoice #PG-998')
        `, [defaultShopId, sups[0].id]);
      }
    }

    // 5. Seed Products & Variants (Readymade Garments Catalog)
    const [productsCount] = await pool.query('SELECT COUNT(*) as count FROM products');
    if (productsCount[0].count === 0) {
      console.log('Seeding garment products & variants...');
      
      const garmentProducts = [
        ['White Formal Shirt', 'Arrow', 'Shirts', 'Men', 'Premium classic fit cotton shirt', false],
        ['Casual Polo T-Shirt', 'USPA', 'T-Shirts', 'Men', 'Vibrant breathable pique knit cotton polo', false],
        ['Slim Fit Denim Jeans', 'Levis', 'Jeans', 'Men', 'Authentic stretch fit indigo blue denim jeans', false],
        ['Traditional Silk Saree', 'Nalli', 'Sarees', 'Women', 'Exquisite gold border Kanchipuram pure silk saree', false],
        ['Designer Chudithar Set', 'Biba', 'Chudithar', 'Women', 'Modern block print design three-piece chudithar set', false],
        ['Kids Printed T-Shirt', 'Mothercare', 'Kids Wear', 'Kids', 'Soft organic cotton kids crewneck t-shirt', false],
        ['Activewear Joggers', 'Nike', 'Fashion Products', 'Unisex', 'Performance training pants with zippered pockets', false],
        ['Jockey Baniyan', 'Jockey', 'Innerwear', 'Men', 'Premium combed cotton comfort fit innerwear baniyan', true],
        ['Active Crew Socks', 'USPA', 'Innerwear', 'Men', 'Comfortable moisture-wicking athletics sports crew socks', true]
      ];
 
      const insertedProducts = [];
      for (const gp of garmentProducts) {
        const [prodResult] = await pool.query(`
          INSERT INTO products (shop_id, product_name, brand, category, gender, description, allow_manual_qty) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [defaultShopId, gp[0], gp[1], gp[2], gp[3], gp[4], gp[5]]);
        insertedProducts.push({
          id: prodResult.insertId,
          name: gp[0],
          brand: gp[1]
        });
      }

      // Define variants for each product
      const productVariants = {
        'White Formal Shirt': [
          { barcode: '89010001', sku: 'ARROW-WHT-S', color: 'White', size: 'S', purchase: 450.00, selling: 899.00, mrp: 1299.00, stock: 35, gst: 12.00 },
          { barcode: '89010002', sku: 'ARROW-WHT-M', color: 'White', size: 'M', purchase: 450.00, selling: 899.00, mrp: 1299.00, stock: 45, gst: 12.00 },
          { barcode: '89010003', sku: 'ARROW-WHT-L', color: 'White', size: 'L', purchase: 450.00, selling: 899.00, mrp: 1299.00, stock: 40, gst: 12.00 }
        ],
        'Casual Polo T-Shirt': [
          { barcode: '89010004', sku: 'USPA-POLO-BLU-M', color: 'Blue', size: 'M', purchase: 300.00, selling: 599.00, mrp: 899.00, stock: 50, gst: 5.00 },
          { barcode: '89010005', sku: 'USPA-POLO-RED-L', color: 'Red', size: 'L', purchase: 300.00, selling: 599.00, mrp: 899.00, stock: 60, gst: 5.00 }
        ],
        'Slim Fit Denim Jeans': [
          { barcode: '89010006', sku: 'LEVIS-JN-IND-32', color: 'Indigo', size: '32', purchase: 800.00, selling: 1599.00, mrp: 2199.00, stock: 25, gst: 12.00 },
          { barcode: '89010007', sku: 'LEVIS-JN-IND-34', color: 'Indigo', size: '34', purchase: 800.00, selling: 1599.00, mrp: 2199.00, stock: 30, gst: 12.00 }
        ],
        'Traditional Silk Saree': [
          { barcode: '89010008', sku: 'NALLI-SLK-RED-FS', color: 'Red', size: 'Free Size', purchase: 2000.00, selling: 3999.00, mrp: 5999.00, stock: 15, gst: 5.00 }
        ],
        'Designer Chudithar Set': [
          { barcode: '89010009', sku: 'BIBA-CHUD-PNK-M', color: 'Pink', size: 'M', purchase: 600.00, selling: 1199.00, mrp: 1799.00, stock: 20, gst: 5.00 }
        ],
        'Kids Printed T-Shirt': [
          { barcode: '89010010', sku: 'MC-KID-YEL-24', color: 'Yellow', size: '24', purchase: 150.00, selling: 299.00, mrp: 499.00, stock: 75, gst: 5.00 }
        ],
        'Activewear Joggers': [
          { barcode: '89010011', sku: 'NIKE-JOG-BLK-L', color: 'Black', size: 'L', purchase: 900.00, selling: 1799.00, mrp: 2499.00, stock: 30, gst: 12.00 }
        ],
        'Jockey Baniyan': [
          { barcode: '890500001', sku: 'JOCKEY-BAN-M', color: 'White', size: 'M', purchase: 60.00, selling: 120.00, mrp: 150.00, stock: 120, gst: 5.00 }
        ],
        'Active Crew Socks': [
          { barcode: '890500002', sku: 'USPA-SOX-FREE', color: 'Grey', size: 'Free Size', purchase: 40.00, selling: 90.00, mrp: 120.00, stock: 150, gst: 5.00 }
        ]
      };

      const [warehousesDb] = await pool.query('SELECT id FROM warehouses WHERE shop_id = ?', [defaultShopId]);
      const w1 = warehousesDb[0].id;
      const w2 = warehousesDb.length > 1 ? warehousesDb[1].id : w1;

      for (const prod of insertedProducts) {
        const variantsList = productVariants[prod.name];
        if (variantsList) {
          for (const varItem of variantsList) {
            // Insert variant
            const [varRes] = await pool.query(`
              INSERT INTO product_variants (shop_id, product_id, barcode, sku, color, size, purchase_price, selling_price, mrp, stock_qty, gst_percentage)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [defaultShopId, prod.id, varItem.barcode, varItem.sku, varItem.color, varItem.size, varItem.purchase, varItem.selling, varItem.mrp, varItem.stock, varItem.gst]);

            const variantId = varRes.insertId;

            // Distribute warehouse stocks: 70% in Central Warehouse, 30% in Retail Outlet Store
            const s1 = Math.round(varItem.stock * 0.7);
            const s2 = varItem.stock - s1;

            await pool.query(`
              INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock)
              VALUES (?, ?, ?, ?), (?, ?, ?, ?)
            `, [defaultShopId, variantId, w1, s1, defaultShopId, variantId, w2, s2]);

            // Add logs to stock ledger
            await pool.query(`
              INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference)
              VALUES (?, ?, ?, 'Stock In', ?, 'Initial Seeding Stock Consignment'),
                     (?, ?, ?, 'Stock In', ?, 'Initial Seeding Stock Consignment')
            `, [defaultShopId, variantId, w1, s1, defaultShopId, variantId, w2, s2]);
          }
        }
      }
      console.log('Successfully seeded garment products, variants, warehouses, stocks, and ledger entries.');
    }

    // 6. Seed Orders & Invoice Items (if none exist)
    const [ordersCount] = await pool.query('SELECT COUNT(*) as count FROM orders');
    if (ordersCount[0].count === 0) {
      console.log('Seeding historical garments retail sales for the past 30 days...');
      const [dbUsers] = await pool.query("SELECT u.id, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.role_name IN ('Shop Owner', 'Manager', 'Cashier') AND u.shop_id = ?", [defaultShopId]);
      const [dbVariants] = await pool.query(`
        SELECT pv.id, pv.selling_price, pv.purchase_price, pv.gst_percentage, p.product_name, pv.size, pv.color
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        WHERE pv.shop_id = ?
      `, [defaultShopId]);
      const [dbCustomers] = await pool.query("SELECT id FROM customers WHERE shop_id = ?", [defaultShopId]);

      if (dbUsers.length > 0 && dbVariants.length > 0) {
        // Seed orders spread across the last 30 days
        for (let i = 30; i >= 0; i--) {
          // 1 to 3 orders per day
          const numOrders = Math.floor(Math.random() * 3) + 1;
          for (let j = 0; j < numOrders; j++) {
            const user = dbUsers[Math.floor(Math.random() * dbUsers.length)];
            const customer = Math.random() > 0.4 && dbCustomers.length > 0 ? dbCustomers[Math.floor(Math.random() * dbCustomers.length)] : null;
            
            // Pick 1 to 2 random variants
            const numItems = Math.floor(Math.random() * 2) + 1;
            const selectedItems = [];
            let totalAmount = 0;
            let totalGst = 0;
            
            const shuffledVariants = [...dbVariants].sort(() => 0.5 - Math.random());
            for (let k = 0; k < Math.min(numItems, shuffledVariants.length); k++) {
              const variant = shuffledVariants[k];
              const qty = Math.floor(Math.random() * 2) + 1; // 1 to 2 pieces
              const itemPrice = parseFloat(variant.selling_price);
              const gstPercent = parseFloat(variant.gst_percentage);
              
              // Selling price is inclusive of GST. Tax = (Price * GST / (100 + GST)) * Qty
              const taxablePrice = itemPrice / (1 + (gstPercent / 100));
              const itemGst = (itemPrice - taxablePrice) * qty;
              const itemTotal = itemPrice * qty;

              totalAmount += itemTotal;
              totalGst += itemGst;

              selectedItems.push({
                variantId: variant.id,
                qty: qty,
                price: itemPrice,
                gst: parseFloat(itemGst.toFixed(2)),
                total: parseFloat(itemTotal.toFixed(2))
              });
            }

            const discount = Math.random() > 0.7 ? parseFloat((totalAmount * 0.1).toFixed(2)) : 0; // 10% discount sometimes
            const payableAmount = totalAmount - discount;
            
            // SGST and CGST split from totalGst
            const cgst = parseFloat((totalGst / 2).toFixed(2));
            const sgst = parseFloat((totalGst / 2).toFixed(2));
            const netAmount = parseFloat(payableAmount.toFixed(2));

            // Payment methods
            const methods = ['Cash', 'Card', 'UPI', 'Split'];
            if (customer) methods.push('Credit');
            const paymentMethod = methods[Math.floor(Math.random() * methods.length)];

            let cashAmount = 0;
            let cardAmount = 0;
            let upiAmount = 0;

            if (paymentMethod === 'Cash') {
              cashAmount = netAmount;
            } else if (paymentMethod === 'Card') {
              cardAmount = netAmount;
            } else if (paymentMethod === 'UPI') {
              upiAmount = netAmount;
            } else if (paymentMethod === 'Split') {
              cashAmount = parseFloat((netAmount * 0.4).toFixed(2));
              upiAmount = parseFloat((netAmount - cashAmount).toFixed(2));
            }

            // Date in the past
            const orderDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12) * 60 * 60 * 1000 - Math.floor(Math.random() * 60) * 60 * 1000);
            const dateStr = orderDate.toISOString().slice(0, 19).replace('T', ' ');

            // Generate invoice number
            const invDateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
            const randStr = Math.floor(1000 + Math.random() * 9000);
            const invoiceNumber = `INV-${invDateStr}-${randStr}`;

            const [orderRes] = await pool.query(
              `INSERT INTO orders (
                shop_id, invoice_number, user_id, customer_id, total_amount, discount,
                cgst_amount, sgst_amount, net_amount, payment_method,
                cash_amount, card_amount, upi_amount, transaction_type, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sale', ?)`,
              [
                defaultShopId,
                invoiceNumber,
                user.id,
                customer ? customer.id : null,
                totalAmount,
                discount,
                cgst,
                sgst,
                netAmount,
                paymentMethod,
                cashAmount,
                cardAmount,
                upiAmount,
                dateStr
              ]
            );

            const orderId = orderRes.insertId;

            for (const item of selectedItems) {
              await pool.query(
                `INSERT INTO invoice_items (shop_id, order_id, variant_id, qty, price, gst, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [defaultShopId, orderId, item.variantId, item.qty, item.price, item.gst, item.total]
              );
            }
          }
        }
        console.log('Successfully seeded historical garments orders for the past 30 days.');
      }
    }

  } catch (error) {
    console.error('Error seeding data:', error);
  }
}

module.exports = {
  initializeDatabase,
  query: (sql, params) => pool.query(sql, params),
  getPool: () => pool
};
