-- ============================================================================
-- HIGH-SPEED READYMADE GARMENTS POS ERP DATABASE ARCHITECTURE
-- DATABASE: MySQL 8.0+ / MariaDB 10.5+
-- ENGINE: InnoDB (Highly Transactional, Row-Level Locking, ACID Compliant)
-- CHARACTER SET: utf8mb4 (Full Unicode / Emoji Support)
-- COLLATE: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `textile_pos_erp`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `textile_pos_erp`;

-- Disable foreign key checks temporarily during rebuild/initialization
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Drop existing tables in reverse order of foreign key dependency
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `invoice_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `stock_ledger`;
DROP TABLE IF EXISTS `product_warehouse_stock`;
DROP TABLE IF EXISTS `customer_ledger`;
DROP TABLE IF EXISTS `supplier_ledger`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `warehouses`;
DROP TABLE IF EXISTS `product_variants`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `users`;

-- ============================================================================
-- 1. DATABASE SCHEMA TABLES & CONSTRAINTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: users
-- Tracks staff credentials, hashed passwords, and active session tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('Admin', 'Manager', 'Cashier', 'Stock Manager') NOT NULL,
    `refresh_token` VARCHAR(255) NULL,
    `password_reset_token` VARCHAR(255) NULL,
    `password_reset_expires` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: customers
-- Guest and Loyalty customer records with point summaries & credit tabs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) UNIQUE NOT NULL,
    `email` VARCHAR(100) NULL,
    `loyalty_points` INT NOT NULL DEFAULT 0,
    `gst_number` VARCHAR(15) NULL COMMENT 'Client Indian GSTIN (for B2B transactions)',
    `credit_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Outstanding credit ledger tab',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: products
-- Base garments product definitions without sizing or color specifics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `product_name` VARCHAR(100) NOT NULL,
    `brand` VARCHAR(50) NULL,
    `category` VARCHAR(50) NOT NULL COMMENT 'Shirts, T-Shirts, Jeans, Pants, Sarees, Chudithar, Fashion Products, etc.',
    `gender` ENUM('Men', 'Women', 'Kids', 'Unisex') NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: product_variants
-- Granular variant sizing, colors, unique scannable barcodes, and pricing structures
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT UNSIGNED NOT NULL,
    `barcode` VARCHAR(50) UNIQUE NOT NULL COMMENT 'Hardware scanner scannable target',
    `sku` VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique identifier per SKU',
    `color` VARCHAR(30) NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `purchase_price` DECIMAL(10, 2) NOT NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `mrp` DECIMAL(10, 2) NOT NULL,
    `stock_qty` INT NOT NULL DEFAULT 0 COMMENT 'Global accumulated stock levels',
    `gst_percentage` DECIMAL(5, 2) NOT NULL DEFAULT 12.00 COMMENT 'GST Percentage rate',
    `image` VARCHAR(255) NULL COMMENT 'Asset path or relative image url',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_variants_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: warehouses
-- Storage depots and retail point-of-sale warehouses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouses` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(150) NOT NULL,
    `capacity` INT NOT NULL DEFAULT 10000 COMMENT 'Storage capacity metrics for warning levels',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: suppliers
-- Supplies raw fabrics and garments, tracks pending invoices and credit balances
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `contact_person` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(100) NULL,
    `gstin` VARCHAR(15) NULL COMMENT 'Vendor 15-digit GSTIN number',
    `credit_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Outstanding accounts payable due to supplier',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: supplier_ledger
-- Double-entry transactional ledger tracking supplier invoicing & payables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `supplier_ledger` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `supplier_id` INT UNSIGNED NOT NULL,
    `type` ENUM('Invoice', 'Payment') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(200) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_supplier_ledger_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: customer_ledger
-- Double-entry ledger monitoring outstanding client credit invoices & repayments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_ledger` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT UNSIGNED NOT NULL,
    `type` ENUM('Invoice', 'Payment') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(200) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_customer_ledger_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: product_warehouse_stock
-- Composite allocation map tracking variant stocks local to warehouses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_warehouse_stock` (
    `variant_id` INT UNSIGNED NOT NULL,
    `warehouse_id` INT UNSIGNED NOT NULL,
    `stock` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`variant_id`, `warehouse_id`),
    CONSTRAINT `fk_pw_stock_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_pw_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: stock_ledger
-- Logs all physical variant adjustments, damage scraps, and depot transfers
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_ledger` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `variant_id` INT UNSIGNED NOT NULL,
    `warehouse_id` INT UNSIGNED NOT NULL,
    `type` ENUM('Stock In', 'Stock Out', 'Stock Transfer', 'Warehouse Transfer', 'Stock Adjustment', 'Stock Reconciliation', 'Damage') NOT NULL,
    `quantity` INT NOT NULL,
    `reference` VARCHAR(150) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_stock_ledger_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_stock_ledger_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: orders
-- Central invoices registry monitoring net totals, GST returns, and payment splits
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `invoice_number` VARCHAR(50) UNIQUE NOT NULL COMMENT 'Prefix formats: INV-, RET-, EXC-',
    `user_id` INT UNSIGNED NOT NULL,
    `customer_id` INT UNSIGNED NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL COMMENT 'Gross total before discount/tax',
    `discount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `coupon_code` VARCHAR(30) NULL,
    `cgst_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `sgst_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `net_amount` DECIMAL(10, 2) NOT NULL COMMENT 'Final net consumer bill amount',
    `payment_method` VARCHAR(50) NOT NULL DEFAULT 'Split' COMMENT 'Cash, Card, UPI, Credit, or Split',
    `cash_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `card_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `upi_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `transaction_type` ENUM('Sale', 'Return', 'Exchange') NOT NULL DEFAULT 'Sale',
    `original_invoice_number` VARCHAR(50) NULL COMMENT 'References original sale for return/exchanges',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: invoice_items
-- Granular variant product lines inside POS billing orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `invoice_items` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT UNSIGNED NOT NULL,
    `variant_id` INT UNSIGNED NOT NULL,
    `qty` INT NOT NULL COMMENT 'Garment pieces quantity (integers only)',
    `price` DECIMAL(10, 2) NOT NULL COMMENT 'Selling price of single unit',
    `gst` DECIMAL(10, 2) NOT NULL COMMENT 'GST tax amount for this item line',
    `total` DECIMAL(10, 2) NOT NULL COMMENT 'Net item line total including GST',
    CONSTRAINT `fk_invoice_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_invoice_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- Table: audit_logs
-- Captures security transitions, administrative tasks, and restricted accesses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `details` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key constraints
SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================================
-- 2. HIGH-SPEED PERFORMANCE DATABASE INDEXES
-- ============================================================================

-- B-Tree indexes on product search matrices (Crucial for F2 scannable lookups!)
CREATE INDEX `idx_variants_barcode` ON `product_variants` (`barcode`);
CREATE INDEX `idx_variants_sku` ON `product_variants` (`sku`);
CREATE INDEX `idx_products_cat_name` ON `products` (`category`, `product_name`);

-- Composite indexes on orders reporting date frames
CREATE INDEX `idx_orders_customer_date` ON `orders` (`customer_id`, `created_at`);
CREATE INDEX `idx_orders_user_date` ON `orders` (`user_id`, `created_at`);
CREATE INDEX `idx_orders_date_type` ON `orders` (`created_at`, `transaction_type`);

-- Indexes to maximize database join operations speed
CREATE INDEX `idx_invoice_items_variant` ON `invoice_items` (`variant_id`);
CREATE INDEX `idx_stock_ledger_var_wh` ON `stock_ledger` (`variant_id`, `warehouse_id`);
CREATE INDEX `idx_customer_ledger_cust` ON `customer_ledger` (`customer_id`);
CREATE INDEX `idx_supplier_ledger_sup` ON `supplier_ledger` (`supplier_id`);


-- ============================================================================
-- 3. SEEDING STANDARD DATA (BOOTSTRAP DEVELOPMENT ENVIRONMENT)
-- ============================================================================

-- Password hashes represent default bcrypt hashes matching their username + '123'
-- Admin: admin123 | Manager: manager123 | Cashier: cashier123 | Stock Manager: stock123
INSERT INTO `users` (`username`, `password_hash`, `role`) VALUES 
('admin', '$2a$10$VuBi4HkNCZASH3YJVXM/8ueVp/XQY5xkIVZ5bO43S8dbUFkKVKJim', 'Admin'),
('manager', '$2a$10$QaSS9EtKmXxIaWbOG.gWuOlsGDKFde7G4GIxfEbNlfuxAO7X.nENi', 'Manager'),
('cashier', '$2a$10$Rw874SqZVC3bwdpffTwZPuzDcR.q7EMqNdbUBiQ0iqGwQw0.3VHzi', 'Cashier'),
('stock', '$2a$10$/riRonsu/ZHxbl73WQ6LOewqRx3JLwp.X5UAyvOLlwKyKK1ab../K', 'Stock Manager');

-- Default storage structures
INSERT INTO `warehouses` (`name`, `location`, `capacity`) VALUES 
('Central Warehouse', 'Sector 10, Industrial Hub', 50000),
('Retail Outlet Store', 'Basement Level 1, Main Plaza', 10000);

-- B2B & B2C Loyalty Customers
INSERT INTO `customers` (`name`, `phone`, `email`, `loyalty_points`, `gst_number`, `credit_balance`) VALUES 
('Rahul Sharma', '9876543210', 'rahul@gmail.com', 150, '27ABCDE1234A1Z1', 0.00),
('Anjali Varma', '8765432109', 'anjali@outlook.com', 45, NULL, 120.00),
('Vikram Malhotra', '7654321098', 'vikram@textiles.com', 320, '27FGHIJ5678B1Z2', 0.00);

-- Opening outstanding balance invoice logged in Anjali's loyalty credit ledger
INSERT INTO `customer_ledger` (`customer_id`, `type`, `amount`, `balance_after`, `description`) VALUES 
(2, 'Invoice', 120.00, 120.00, 'Opening outstanding balance invoice');

-- Garments Suppliers
INSERT INTO `suppliers` (`name`, `contact_person`, `phone`, `email`, `gstin`, `credit_balance`) VALUES 
('Premium Garments Co.', 'Amit Patel', '9988776655', 'sales@premiumgarments.com', '27AAAAA1111A1Z1', 2500.00),
('Vogue Fashion Spinners', 'Sanjay Shah', '9876501234', 'info@voguefashion.com', '27BBBBB2222B2Z2', 0.00);

-- Initial Silk consignment invoice logged in Premium Garments Co. ledger
INSERT INTO `supplier_ledger` (`supplier_id`, `type`, `amount`, `balance_after`, `description`) VALUES 
(1, 'Invoice', 2500.00, 2500.00, 'Initial Garments stock invoice #PG-998');
