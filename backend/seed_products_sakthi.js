const mysql = require('mysql2/promise');

async function seedProducts() {
  console.log('Seeding products for Sakthi readymade (Shop ID = 2)...');
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    database: 'textile_pos_erp'
  });

  try {
    const shopId = 2; // Sakthi readymade
    
    // Check if products already exist for Shop 2
    const [existingProds] = await connection.query('SELECT COUNT(*) as count FROM products WHERE shop_id = ?', [shopId]);
    if (existingProds[0].count > 0) {
      console.log('Products already seeded for Sakthi readymade.');
      process.exit(0);
    }

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

    const [warehousesDb] = await connection.query('SELECT id FROM warehouses WHERE shop_id = ?', [shopId]);
    if (warehousesDb.length === 0) {
      throw new Error('Warehouse not found for Sakthi readymade.');
    }
    const w1 = warehousesDb[0].id;

    for (const gp of garmentProducts) {
      const [prodResult] = await connection.query(`
        INSERT INTO products (shop_id, product_name, brand, category, gender, description, allow_manual_qty) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [shopId, gp[0], gp[1], gp[2], gp[3], gp[4], gp[5]]);
      
      const productId = prodResult.insertId;
      const variantsList = productVariants[gp[0]];
      
      if (variantsList) {
        for (const varItem of variantsList) {
          // Insert variant
          const [varRes] = await connection.query(`
            INSERT INTO product_variants (shop_id, product_id, barcode, sku, color, size, purchase_price, selling_price, mrp, stock_qty, gst_percentage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [shopId, productId, varItem.barcode, varItem.sku, varItem.color, varItem.size, varItem.purchase, varItem.selling, varItem.mrp, varItem.stock, varItem.gst]);

          const variantId = varRes.insertId;

          // Seed warehouse stocks
          await connection.query(`
            INSERT INTO product_warehouse_stock (shop_id, variant_id, warehouse_id, stock)
            VALUES (?, ?, ?, ?)
          `, [shopId, variantId, w1, varItem.stock]);

          // Add logs to stock ledger
          await connection.query(`
            INSERT INTO stock_ledger (shop_id, variant_id, warehouse_id, type, quantity, reference)
            VALUES (?, ?, ?, 'Stock In', ?, 'Initial Seeding Stock Consignment')
          `, [shopId, variantId, w1, varItem.stock]);
        }
      }
    }
    
    console.log('Successfully seeded garment catalog for Sakthi readymade shop!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding products:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedProducts();
