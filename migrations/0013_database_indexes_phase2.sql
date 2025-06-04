-- Phase 2: High Impact Performance Indexes
-- These indexes optimize common business operations and reporting

-- Products Table Additional Indexes
CREATE INDEX IF NOT EXISTS idx_products_location ON products(location) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_inventory_status ON products(current_stock, min_stock_level, category_id);
CREATE INDEX IF NOT EXISTS idx_products_stock_value ON products(category_id, current_stock) WHERE current_stock > 0;

-- Orders Table Advanced Indexes
CREATE INDEX IF NOT EXISTS idx_orders_area ON orders(area) WHERE area IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_estimated_shipping ON orders(estimated_shipping_date) WHERE estimated_shipping_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_window ON orders(estimated_shipping_date, status) WHERE status != 'shipped';
CREATE INDEX IF NOT EXISTS idx_orders_customer_history ON orders(customer_name, order_date DESC);

-- Order Items Advanced Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_quality_issues ON order_items(has_quality_issues) WHERE has_quality_issues = true;
CREATE INDEX IF NOT EXISTS idx_order_items_fulfillment ON order_items(order_id, shipping_status, shipped_quantity);
CREATE INDEX IF NOT EXISTS idx_order_items_partial_shipment ON order_items(shipped_quantity, quantity) WHERE shipped_quantity < quantity;

-- Customers Table Indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_vat_number ON customers(vat_number) WHERE vat_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Categories and Tags Indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_product_tags_product_id ON product_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id ON product_tags(tag_id);

-- Shipping Documents Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_docs_order_id ON shipping_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_docs_tracking ON shipping_documents(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipping_docs_upload_date ON shipping_documents(upload_date);
CREATE INDEX IF NOT EXISTS idx_shipping_docs_type ON shipping_documents(document_type);

-- Performance Analysis Comments
-- idx_products_inventory_status: Optimizes complex inventory reports
-- idx_orders_customer_history: Speeds up customer service queries
-- idx_order_items_fulfillment: Critical for shipping workflow
-- idx_shipping_docs_tracking: Essential for package tracking