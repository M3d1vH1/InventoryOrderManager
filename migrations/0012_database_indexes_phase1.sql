-- Phase 1: Critical Performance Indexes
-- These indexes address the most frequent queries and performance bottlenecks

-- Products Table Indexes (Critical for inventory management)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_current_stock ON products(current_stock);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(current_stock, min_stock_level) WHERE current_stock <= min_stock_level;
CREATE INDEX IF NOT EXISTS idx_products_last_stock_update ON products(last_stock_update);

-- Orders Table Indexes (Critical for order management)
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, order_date);

-- Order Items Table Indexes (Critical for order processing)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_composite ON order_items(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shipping_status ON order_items(shipping_status);

-- Users Table Indexes (Authentication and auditing)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Performance Analysis Comments
-- idx_products_sku: Critical for barcode scanning and product lookups
-- idx_products_low_stock: Optimizes low stock alerts and inventory reports
-- idx_orders_status_date: Optimizes order dashboard and filtering
-- idx_order_items_composite: Essential for order fulfillment queries