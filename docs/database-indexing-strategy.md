# Database Indexing Strategy for PostgreSQL with Drizzle ORM

## Analysis of Current Schema and Query Patterns

Based on your warehouse management system schema and query patterns, here are the critical indexing opportunities:

### High-Impact Indexes (Implement First)

#### Products Table
```sql
-- Most critical for inventory management
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_current_stock ON products(current_stock);
CREATE INDEX idx_products_low_stock ON products(current_stock, min_stock_level) WHERE current_stock <= min_stock_level;
CREATE INDEX idx_products_last_stock_update ON products(last_stock_update);
CREATE INDEX idx_products_location ON products(location) WHERE location IS NOT NULL;
```

#### Orders Table
```sql
-- Critical for order management and reporting
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_customer_name ON orders(customer_name);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_priority ON orders(priority);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status_date ON orders(status, order_date);
CREATE INDEX idx_orders_area ON orders(area) WHERE area IS NOT NULL;
CREATE INDEX idx_orders_estimated_shipping ON orders(estimated_shipping_date) WHERE estimated_shipping_date IS NOT NULL;
CREATE INDEX idx_orders_created_by ON orders(created_by_id);
```

#### Order Items Table
```sql
-- Critical for order processing
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_composite ON order_items(order_id, product_id);
CREATE INDEX idx_order_items_shipping_status ON order_items(shipping_status);
CREATE INDEX idx_order_items_quality_issues ON order_items(has_quality_issues) WHERE has_quality_issues = true;
```

### Medium-Impact Indexes

#### Customers Table
```sql
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_city ON customers(city) WHERE city IS NOT NULL;
CREATE INDEX idx_customers_vat_number ON customers(vat_number) WHERE vat_number IS NOT NULL;
```

#### Order Changelogs Table
```sql
CREATE INDEX idx_order_changelogs_order_id ON order_changelogs(order_id);
CREATE INDEX idx_order_changelogs_user_id ON order_changelogs(user_id);
CREATE INDEX idx_order_changelogs_timestamp ON order_changelogs(timestamp);
CREATE INDEX idx_order_changelogs_action ON order_changelogs(action);
```

#### Shipping Documents Table
```sql
CREATE INDEX idx_shipping_docs_order_id ON shipping_documents(order_id);
CREATE INDEX idx_shipping_docs_tracking ON shipping_documents(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX idx_shipping_docs_upload_date ON shipping_documents(upload_date);
```

### Production Module Indexes

#### Production Orders Table
```sql
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_product_id ON production_orders(product_id);
CREATE INDEX idx_production_orders_scheduled_date ON production_orders(scheduled_date);
CREATE INDEX idx_production_orders_batch_id ON production_orders(batch_id) WHERE batch_id IS NOT NULL;
```

#### Raw Materials Table
```sql
CREATE INDEX idx_raw_materials_sku ON raw_materials(sku);
CREATE INDEX idx_raw_materials_current_stock ON raw_materials(current_stock);
CREATE INDEX idx_raw_materials_supplier_id ON raw_materials(supplier_id) WHERE supplier_id IS NOT NULL;
```

### Composite Indexes for Complex Queries

```sql
-- Order search and filtering
CREATE INDEX idx_orders_search ON orders(status, priority, order_date);
CREATE INDEX idx_orders_shipping_window ON orders(estimated_shipping_date, status) WHERE status != 'shipped';

-- Product inventory management
CREATE INDEX idx_products_inventory_status ON products(current_stock, min_stock_level, category_id);

-- Order fulfillment tracking
CREATE INDEX idx_order_items_fulfillment ON order_items(order_id, shipping_status, shipped_quantity);

-- Customer order history
CREATE INDEX idx_orders_customer_history ON orders(customer_name, order_date DESC);
```

### Performance Optimization Considerations

#### Partial Indexes
Use partial indexes for commonly filtered subsets:
```sql
-- Only index active orders
CREATE INDEX idx_orders_active ON orders(order_date, priority) WHERE status IN ('pending', 'picked');

-- Only index products with stock issues
CREATE INDEX idx_products_stock_issues ON products(category_id, current_stock) WHERE current_stock <= min_stock_level;

-- Only index orders with shipping documents
CREATE INDEX idx_orders_with_docs ON orders(order_date) WHERE has_shipping_document = true;
```

#### Text Search Indexes
For name-based searches:
```sql
-- Enable faster LIKE queries
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
```

## Query Pattern Analysis

### Most Common Query Types

1. **Product Lookups by SKU/Barcode** - Critical for inventory operations
2. **Order Status Filtering** - Essential for order management
3. **Low Stock Alerts** - Important for inventory monitoring
4. **Customer Order History** - Frequent for customer service
5. **Order Item Fulfillment** - Critical for shipping operations

### Performance Bottlenecks Identified

1. **Product filtering without indexes** on current_stock and min_stock_level
2. **Order searches** without proper composite indexes
3. **Customer lookups** by name without text search optimization
4. **Order history queries** missing date-based indexes

## Implementation Priority

### Phase 1 (Immediate - Critical Performance)
- Products: SKU, barcode, stock levels
- Orders: order_number, status, customer_name
- Order Items: order_id, product_id composite

### Phase 2 (High Impact)
- Orders: date-based and priority indexes
- Products: category and location indexes
- Order Changelogs: order_id and timestamp

### Phase 3 (Optimization)
- Text search indexes for names
- Partial indexes for filtered queries
- Composite indexes for complex searches