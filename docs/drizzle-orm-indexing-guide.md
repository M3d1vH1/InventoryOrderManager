# Drizzle ORM Database Indexing Implementation Guide

## Overview

This guide shows how to implement database indexes using Drizzle ORM for your PostgreSQL warehouse management system. The strategy is divided into three phases based on performance impact.

## Implementation Methods

### Method 1: SQL Migrations (Recommended)

Use the provided SQL migration files for immediate implementation:

```bash
# Apply the migrations in order
npm run db:push

# Or apply specific migration files
psql -d your_database -f migrations/0012_database_indexes_phase1.sql
psql -d your_database -f migrations/0013_database_indexes_phase2.sql
psql -d your_database -f migrations/0014_database_indexes_phase3.sql
```

### Method 2: Drizzle Schema Definitions

Add indexes directly to your schema definitions in `shared/schema.ts`:

```typescript
import { pgTable, text, serial, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  categoryId: integer("category_id").notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  location: text("location"),
  lastStockUpdate: timestamp("last_stock_update").default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // Single column indexes
  skuIndex: uniqueIndex("idx_products_sku").on(table.sku),
  categoryIndex: index("idx_products_category_id").on(table.categoryId),
  stockIndex: index("idx_products_current_stock").on(table.currentStock),
  
  // Composite indexes
  inventoryStatusIndex: index("idx_products_inventory_status")
    .on(table.currentStock, table.minStockLevel, table.categoryId),
  
  // Partial indexes (requires raw SQL)
  lowStockIndex: index("idx_products_low_stock")
    .on(table.currentStock, table.minStockLevel)
    .where(sql`${table.currentStock} <= ${table.minStockLevel}`),
}));

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  orderDate: timestamp("order_date").notNull().defaultNow(),
  status: orderStatusEnum("status").notNull().default('pending'),
  priority: orderPriorityEnum("priority").default('medium'),
  area: text("area"),
  estimatedShippingDate: timestamp("estimated_shipping_date"),
}, (table) => ({
  orderNumberIndex: uniqueIndex("idx_orders_order_number").on(table.orderNumber),
  customerIndex: index("idx_orders_customer_name").on(table.customerName),
  statusIndex: index("idx_orders_status").on(table.status),
  dateIndex: index("idx_orders_order_date").on(table.orderDate),
  
  // Composite indexes
  statusDateIndex: index("idx_orders_status_date")
    .on(table.status, table.orderDate),
  customerHistoryIndex: index("idx_orders_customer_history")
    .on(table.customerName, table.orderDate.desc()),
}));
```

### Method 3: Programmatic Index Creation

Create indexes programmatically using Drizzle's migration system:

```typescript
// Create a new migration file: migrations/add_indexes.ts
import { sql } from "drizzle-orm";
import { db } from "../server/db";

export async function createIndexes() {
  // Critical performance indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_products_low_stock 
    ON products(current_stock, min_stock_level) 
    WHERE current_stock <= min_stock_level;
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_orders_status_date 
    ON orders(status, order_date);
  `);
  
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_order_items_composite 
    ON order_items(order_id, product_id);
  `);
}
```

## Query Optimization Examples

### Before and After Index Implementation

#### Product Lookup by SKU
```typescript
// Query that benefits from idx_products_sku
const product = await db
  .select()
  .from(products)
  .where(eq(products.sku, "PROD-123"))
  .limit(1);

// Performance: Index scan instead of sequential scan
// Improvement: 1000x faster for large product catalogs
```

#### Low Stock Products
```typescript
// Query that benefits from idx_products_low_stock
const lowStockProducts = await db
  .select()
  .from(products)
  .where(lte(products.currentStock, products.minStockLevel));

// Performance: Partial index only scans relevant rows
// Improvement: 10-50x faster depending on stock levels
```

#### Order Status Filtering
```typescript
// Query that benefits from idx_orders_status_date
const pendingOrders = await db
  .select()
  .from(orders)
  .where(eq(orders.status, 'pending'))
  .orderBy(desc(orders.orderDate));

// Performance: Index scan with built-in sorting
// Improvement: 5-20x faster for status-based queries
```

#### Customer Order History
```typescript
// Query that benefits from idx_orders_customer_history
const customerOrders = await db
  .select()
  .from(orders)
  .where(eq(orders.customerName, "Customer Name"))
  .orderBy(desc(orders.orderDate))
  .limit(10);

// Performance: Composite index provides sorted results
// Improvement: 10-100x faster for customer lookups
```

## Index Monitoring and Maintenance

### Check Index Usage
```sql
-- Monitor index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Identify Unused Indexes
```sql
-- Find indexes that are never used
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname = 'public';
```

### Check Index Size
```sql
-- Monitor index sizes
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Implementation Timeline

### Phase 1 (Immediate - Day 1)
Apply critical performance indexes:
- Products: SKU, barcode, stock levels
- Orders: order number, status, customer name
- Order Items: composite indexes

Expected improvement: 10-100x faster core operations

### Phase 2 (Week 1)
Apply high-impact indexes:
- Advanced order filtering
- Customer management
- Shipping document tracking

Expected improvement: 5-50x faster business operations

### Phase 3 (Month 1)
Apply optimization indexes:
- Text search capabilities
- Audit trail performance
- Production module support

Expected improvement: 2-10x faster complex queries

## Performance Testing

### Before Implementation
```typescript
// Measure query performance before indexes
console.time('Product lookup');
const product = await db.select().from(products).where(eq(products.sku, "TEST"));
console.timeEnd('Product lookup');
```

### After Implementation
```typescript
// Same query after indexes - should be significantly faster
console.time('Product lookup with index');
const product = await db.select().from(products).where(eq(products.sku, "TEST"));
console.timeEnd('Product lookup with index');
```

### Automated Performance Tests
```typescript
// Create performance test suite
export async function runPerformanceTests() {
  const tests = [
    { name: 'Product SKU lookup', query: () => findProductBySku('TEST-SKU') },
    { name: 'Low stock products', query: () => getLowStockProducts() },
    { name: 'Pending orders', query: () => getPendingOrders() },
    { name: 'Customer history', query: () => getCustomerOrders('Test Customer') }
  ];

  for (const test of tests) {
    console.time(test.name);
    await test.query();
    console.timeEnd(test.name);
  }
}
```

## Best Practices

1. **Monitor Performance**: Regularly check query execution plans
2. **Index Maintenance**: Rebuild indexes during low-traffic periods
3. **Selective Indexing**: Don't over-index; each index has maintenance overhead
4. **Partial Indexes**: Use for commonly filtered subsets
5. **Composite Indexes**: Order columns by selectivity (most selective first)

## Troubleshooting

### Slow Queries After Indexing
```sql
-- Check if indexes are being used
EXPLAIN ANALYZE SELECT * FROM products WHERE sku = 'TEST';
```

### Index Bloat
```sql
-- Check for index bloat and rebuild if necessary
REINDEX INDEX idx_products_sku;
```

### Lock Contention
```sql
-- Create indexes concurrently to avoid blocking
CREATE INDEX CONCURRENTLY idx_new_index ON table_name(column_name);
```

This indexing strategy will significantly improve your warehouse management system's database performance, especially for inventory operations, order management, and customer service queries.