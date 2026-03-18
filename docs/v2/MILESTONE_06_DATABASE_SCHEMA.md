# Milestone 06 — Database Schema V2

**Priority:** P1
**Depends on:** Milestone 01 (Docker with postgres:16)
**Blocks:** Milestone 07 (bug fixes depend on reserved_stock)

---

## Objective

Harden the database with:
1. `reserved_stock` field on products (enables proper stock reservation model)
2. Foreign key constraints on all tables that reference other tables
3. CHECK constraints for data invariants (stock >= 0, reserved <= current)
4. Database-level triggers for payment validation
5. Performance indexes on frequently-queried columns

This is a migration-based approach — we write SQL migration files that run on first start.

---

## Key Schema Changes

### Change 1: Add `reserved_stock` to Products

**Why:** The current system deducts stock at order creation. The correct model is:
- `current_stock` = physical inventory in the warehouse
- `reserved_stock` = committed to pending orders but not yet picked
- `available_stock` = current_stock - reserved_stock (computed, not stored)

**When stock changes:**
| Event | current_stock | reserved_stock |
|-------|--------------|----------------|
| Order created (item added) | unchanged | +quantity |
| Item picked (warehouse picks it) | -quantity | -quantity |
| Order cancelled | unchanged | -quantity (release reservation) |
| Stock received from supplier | +quantity | unchanged |
| Manual adjustment | ±quantity | unchanged |

### Change 2: Foreign Key Constraints

Current schema has **zero foreign key constraints**. Every relationship is an application-level integer field with no referential integrity. This allows orphaned records (e.g., order items pointing to deleted products).

### Change 3: CHECK Constraints

Database-level guardrails that prevent invalid states regardless of application bugs:
- `current_stock >= 0`
- `reserved_stock >= 0`
- `reserved_stock <= current_stock`
- `ordered_quantity > 0` on order items

### Change 4: Payment Trigger

Prevent invoice overpayment at the database level:

---

## Migration File: `migrations/001_v2_schema.sql`

Create this file. It will be run automatically on first `docker compose up` via the `docker-entrypoint-initdb.d` directory.

```sql
-- ============================================================
-- Migration 001: V2 Schema Improvements
-- Amphoreus Warehouse Management System V2
-- ============================================================

-- ============================================================
-- SECTION 1: Add reserved_stock to products
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0;

-- Ensure reserved_stock is valid for all existing products
-- (set to 0 for all existing products since we don't have this data)
UPDATE products SET reserved_stock = 0 WHERE reserved_stock IS NULL;

-- Add stock integrity constraints
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_current_stock_non_negative,
  ADD CONSTRAINT chk_current_stock_non_negative
    CHECK (current_stock >= 0);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_reserved_stock_non_negative,
  ADD CONSTRAINT chk_reserved_stock_non_negative
    CHECK (reserved_stock >= 0);

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS chk_reserved_not_exceed_current,
  ADD CONSTRAINT chk_reserved_not_exceed_current
    CHECK (reserved_stock <= current_stock);

-- ============================================================
-- SECTION 2: Add Foreign Key Constraints
-- ============================================================

-- NOTE: Add these with NOT VALID first if table has existing data
-- that may have orphaned records, then VALIDATE separately.
-- If the data is clean, use straight ADD CONSTRAINT.

-- order_items → orders
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS fk_order_items_order,
  ADD CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_order;

-- order_items → products
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS fk_order_items_product,
  ADD CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_product;

-- products → categories
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS fk_products_category,
  ADD CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE products VALIDATE CONSTRAINT fk_products_category;

-- order_changelogs → orders
ALTER TABLE order_changelogs
  DROP CONSTRAINT IF EXISTS fk_changelogs_order,
  ADD CONSTRAINT fk_changelogs_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE order_changelogs VALIDATE CONSTRAINT fk_changelogs_order;

-- order_changelogs → users
ALTER TABLE order_changelogs
  DROP CONSTRAINT IF EXISTS fk_changelogs_user,
  ADD CONSTRAINT fk_changelogs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE order_changelogs VALIDATE CONSTRAINT fk_changelogs_user;

-- unshipped_items → orders
ALTER TABLE unshipped_items
  DROP CONSTRAINT IF EXISTS fk_unshipped_order,
  ADD CONSTRAINT fk_unshipped_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE unshipped_items VALIDATE CONSTRAINT fk_unshipped_order;

-- unshipped_items → products
ALTER TABLE unshipped_items
  DROP CONSTRAINT IF EXISTS fk_unshipped_product,
  ADD CONSTRAINT fk_unshipped_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE unshipped_items VALIDATE CONSTRAINT fk_unshipped_product;

-- inventory_changes → products
ALTER TABLE inventory_changes
  DROP CONSTRAINT IF EXISTS fk_inventory_changes_product,
  ADD CONSTRAINT fk_inventory_changes_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE inventory_changes VALIDATE CONSTRAINT fk_inventory_changes_product;

-- supplier_invoices → suppliers
ALTER TABLE supplier_invoices
  DROP CONSTRAINT IF EXISTS fk_invoices_supplier,
  ADD CONSTRAINT fk_invoices_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE supplier_invoices VALIDATE CONSTRAINT fk_invoices_supplier;

-- supplier_payments → supplier_invoices
ALTER TABLE supplier_payments
  DROP CONSTRAINT IF EXISTS fk_payments_invoice,
  ADD CONSTRAINT fk_payments_invoice
    FOREIGN KEY (invoice_id) REFERENCES supplier_invoices(id)
    ON DELETE RESTRICT
    NOT VALID;

ALTER TABLE supplier_payments VALIDATE CONSTRAINT fk_payments_invoice;

-- ============================================================
-- SECTION 3: Performance Indexes
-- ============================================================

-- Products: fast low-stock queries
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON products(current_stock, min_stock_level)
  WHERE current_stock <= min_stock_level;

-- Products: barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode)
  WHERE barcode IS NOT NULL;

-- Products: SKU lookups (already unique, but explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Orders: status queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Orders: date range queries
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date DESC);

-- Orders: customer name lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(customer_name);

-- Order items: join performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Inventory changes: audit trail queries
CREATE INDEX IF NOT EXISTS idx_inventory_changes_product
  ON inventory_changes(product_id, timestamp DESC);

-- Unshipped items: pending authorization query
CREATE INDEX IF NOT EXISTS idx_unshipped_items_authorized
  ON unshipped_items(authorized, shipped)
  WHERE NOT shipped;

-- Supplier invoices: status filter
CREATE INDEX IF NOT EXISTS idx_invoices_status ON supplier_invoices(status);

-- Call logs: date and status
CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_followup
  ON call_logs(followup_date)
  WHERE followup_date IS NOT NULL;

-- ============================================================
-- SECTION 4: Supplier Payment Trigger (Prevent Overpayment)
-- ============================================================

-- Function to prevent payments exceeding invoice amount
CREATE OR REPLACE FUNCTION check_payment_not_exceed_invoice()
RETURNS TRIGGER AS $$
DECLARE
  invoice_amount DECIMAL(12, 2);
  current_paid DECIMAL(12, 2);
BEGIN
  SELECT amount, COALESCE(paid_amount, 0)
  INTO invoice_amount, current_paid
  FROM supplier_invoices
  WHERE id = NEW.invoice_id;

  IF (current_paid + NEW.amount) > invoice_amount THEN
    RAISE EXCEPTION
      'Payment of % would exceed invoice balance. Invoice: %, Already paid: %, Remaining: %',
      NEW.amount,
      invoice_amount,
      current_paid,
      (invoice_amount - current_paid);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_not_exceed ON supplier_payments;
CREATE TRIGGER trg_payment_not_exceed
  BEFORE INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_not_exceed_invoice();

-- ============================================================
-- SECTION 5: Auto-Update Invoice paid_amount on Payment
-- ============================================================

CREATE OR REPLACE FUNCTION update_invoice_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE supplier_invoices
  SET
    paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
    status = CASE
      WHEN (COALESCE(paid_amount, 0) + NEW.amount) >= amount THEN 'paid'
      WHEN (COALESCE(paid_amount, 0) + NEW.amount) > 0 THEN 'partially_paid'
      ELSE 'pending'
    END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_paid_amount ON supplier_payments;
CREATE TRIGGER trg_update_paid_amount
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_paid_amount();

-- ============================================================
-- SECTION 6: Auto-Update Timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that have updated_at but no auto-update
-- (Check which tables actually have updated_at in the schema)
-- Example:
-- CREATE TRIGGER trg_products_updated_at
--   BEFORE UPDATE ON products
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================
-- SECTION 7: Record Migration
-- ============================================================

-- Create a migrations tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO _migrations (name)
VALUES ('001_v2_schema')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Done
-- ============================================================
SELECT 'Migration 001_v2_schema applied successfully' AS result;
```

---

## Update `shared/schema.ts`

Add `reservedStock` to the products Drizzle schema:

```typescript
// In shared/schema.ts, products table:
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  categoryId: integer("category_id").notNull(),
  description: text("description"),
  minStockLevel: integer("min_stock_level").notNull().default(10),
  currentStock: integer("current_stock").notNull().default(0),
  // V2: Stock reserved for pending orders (not yet picked)
  reservedStock: integer("reserved_stock").notNull().default(0),
  location: text("location"),
  unitsPerBox: integer("units_per_box"),
  imagePath: text("image_path"),
  tags: text("tags").array(),
  lastStockUpdate: timestamp("last_stock_update").default(sql`CURRENT_TIMESTAMP`),
});
```

Also update `insertProductSchema` to include `reservedStock`:
```typescript
export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true })
  .extend({
    // ... existing fields ...
    reservedStock: z.number().min(0).optional().default(0),
  });
```

---

## Verify Migration

```bash
# After docker compose up, check the migration ran:
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT * FROM _migrations;"
# Expected: 001_v2_schema listed

# Check reserved_stock column exists:
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "\d products" | grep reserved_stock
# Expected: reserved_stock integer not null default 0

# Check FK constraints:
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT conname, contype FROM pg_constraint WHERE contype = 'f';"
# Expected: All FK constraints listed

# Check triggers:
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers;"
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
├── migrations/
│   ├── init/
│   │   └── 001_v2_schema.sql    ← NEW: Applied on docker postgres init
│   └── README.md                ← NEW: Migration docs
└── shared/
    └── schema.ts                ← MODIFIED: Add reservedStock field
```

---

## Next Milestone

→ [MILESTONE_07_BUG_FIXES.md](./MILESTONE_07_BUG_FIXES.md) — Critical bug fixes (stock picking, SKU, images)
