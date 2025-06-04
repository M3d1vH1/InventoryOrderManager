-- Phase 3: Advanced Optimization Indexes
-- These indexes provide specialized optimizations for complex queries and text search

-- Enable pg_trgm extension for text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Text Search Indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin(description gin_trgm_ops) WHERE description IS NOT NULL;

-- Order Changelogs Indexes (Audit trail optimization)
CREATE INDEX IF NOT EXISTS idx_order_changelogs_order_id ON order_changelogs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_changelogs_user_id ON order_changelogs(user_id);
CREATE INDEX IF NOT EXISTS idx_order_changelogs_timestamp ON order_changelogs(timestamp);
CREATE INDEX IF NOT EXISTS idx_order_changelogs_action ON order_changelogs(action);
CREATE INDEX IF NOT EXISTS idx_order_changelogs_order_timestamp ON order_changelogs(order_id, timestamp DESC);

-- Production Module Indexes
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_product_id ON production_orders(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_scheduled_date ON production_orders(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_orders_batch_id ON production_orders(batch_id) WHERE batch_id IS NOT NULL;

-- Raw Materials Indexes
CREATE INDEX IF NOT EXISTS idx_raw_materials_sku ON raw_materials(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_materials_current_stock ON raw_materials(current_stock) WHERE current_stock IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_raw_materials_supplier_id ON raw_materials(supplier_id) WHERE supplier_id IS NOT NULL;

-- Supplier and Invoice Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON supplier_invoices(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_invoice_id ON supplier_payments(invoice_id) WHERE invoice_id IS NOT NULL;

-- Call Logs and CRM Indexes
CREATE INDEX IF NOT EXISTS idx_call_logs_customer_name ON call_logs(customer_name) WHERE customer_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_call_date ON call_logs(call_date) WHERE call_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome_id ON call_logs(outcome_id) WHERE outcome_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospective_customers_status ON prospective_customers(status) WHERE status IS NOT NULL;

-- Inventory Management Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_changes_product_id ON inventory_changes(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_changes_change_date ON inventory_changes(change_date) WHERE change_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_history_product_id ON inventory_history(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_predictions_product_id ON inventory_predictions(product_id) WHERE product_id IS NOT NULL;

-- Partial Indexes for Active Records
CREATE INDEX IF NOT EXISTS idx_orders_active_status ON orders(order_date, priority) WHERE status IN ('pending', 'picked');
CREATE INDEX IF NOT EXISTS idx_products_active_inventory ON products(category_id, current_stock) WHERE current_stock > 0;
CREATE INDEX IF NOT EXISTS idx_orders_pending_shipment ON orders(estimated_shipping_date) WHERE status IN ('pending', 'picked') AND estimated_shipping_date IS NOT NULL;

-- Composite Indexes for Dashboard Queries
CREATE INDEX IF NOT EXISTS idx_orders_dashboard ON orders(status, priority, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_products_dashboard ON products(current_stock, min_stock_level, category_id) WHERE current_stock <= min_stock_level;
CREATE INDEX IF NOT EXISTS idx_order_items_dashboard ON order_items(shipping_status, has_quality_issues) WHERE shipping_status != 'shipped';

-- Performance Analysis Comments
-- gin_trgm_ops indexes: Enable fast fuzzy text search for product and customer names
-- Partial indexes: Only index relevant subsets to reduce index size and improve performance
-- Composite dashboard indexes: Optimize common dashboard queries with multiple filters
-- CRM indexes: Support customer relationship management and call tracking features