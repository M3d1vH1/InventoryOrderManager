# Milestone 17 — Data Migration (Neon → V2)

| Field | Value |
|-------|-------|
| **Step** | 17 of 25 |
| **Priority** | P1 |
| **Depends on** | Steps 1–12, 16 |
| **Estimated effort** | 1.5 days |

---

## Goal

Migrate all business data from the V1 Neon PostgreSQL database to the V2 local PostgreSQL instance. The V2 schema is different (new column names, UUID primary keys, FK constraints, `reservedStock` column, etc.), so this is a **transform-and-load** operation — not a direct `pg_restore`. Build a repeatable migration script that can be tested multiple times before the final cutover.

---

## Implementation

### 1. Migration Script — `scripts/migrate-v1-data.ts`

```ts
// scripts/migrate-v1-data.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { v4 as uuid } from "uuid";

// V1 connection (Neon — read-only)
const v1Pool = new pg.Pool({ connectionString: process.env.V1_DATABASE_URL });
const v1 = drizzle(v1Pool);

// V2 connection (local PostgreSQL)
const v2Pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const v2 = drizzle(v2Pool);

// ID mapping: v1_id (integer) → v2_id (UUID)
const idMap = {
  users: new Map<number, string>(),
  products: new Map<number, string>(),
  categories: new Map<number, string>(),
  tags: new Map<number, string>(),
  customers: new Map<number, string>(),
  orders: new Map<number, string>(),
  suppliers: new Map<number, string>(),
};

async function migrate() {
  console.log("=== V1 → V2 Data Migration ===\n");

  // Phase 1: Core tables (order matters for FK constraints)
  await migrateUsers();
  await migrateCategories();
  await migrateTags();
  await migrateProducts();
  await migrateProductTags();
  await migrateCustomers();
  await migrateOrders();
  await migrateOrderItems();
  await migrateInventoryChanges();
  await migrateShippingDocuments();
  await migrateBarcodeScanLogs();
  await migrateOrderChangelogs();

  // Phase 2: Extended tables (only if V2 schema has them)
  await migrateSuppliers();
  await migrateSupplierInvoices();
  await migrateSupplierPayments();
  await migrateCallLogs();
  await migrateProspectiveCustomers();
  await migrateProductionData();

  // Phase 3: Settings
  await migrateSettings();

  // Post-migration: recalculate derived fields
  await recalculateReservedStock();
  await recalculateOrderTotals();

  console.log("\n=== Migration complete! ===");
  printSummary();
}

async function migrateUsers() {
  console.log("Migrating users...");
  const v1Users = await v1Pool.query("SELECT * FROM users");

  for (const row of v1Users.rows) {
    const newId = uuid();
    idMap.users.set(row.id, newId);

    await v2Pool.query(
      `INSERT INTO users (id, username, password_hash, role, full_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO NOTHING`,
      [newId, row.username, row.password, mapRole(row.role), row.full_name ?? row.username, row.created_at]
    );
  }
  console.log(`  ✅ ${v1Users.rows.length} users migrated`);
}

async function migrateProducts() {
  console.log("Migrating products...");
  const v1Products = await v1Pool.query("SELECT * FROM products");

  for (const row of v1Products.rows) {
    const newId = uuid();
    idMap.products.set(row.id, newId);

    await v2Pool.query(
      `INSERT INTO products (id, name, sku, barcode, category_id, description,
        current_stock, reserved_stock, min_stock_level, unit_price, image_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11)`,
      [
        newId,
        row.name,
        row.sku || `SKU-${row.id}`, // Generate SKU if missing
        row.barcode,
        row.category_id ? idMap.categories.get(row.category_id) : null,
        row.description,
        row.current_stock ?? row.stock ?? 0,
        row.min_stock_level ?? 0,
        row.unit_price ?? row.price ?? 0,
        row.image_url,
        row.created_at,
      ]
    );
  }
  console.log(`  ✅ ${v1Products.rows.length} products migrated`);
}

async function migrateOrders() {
  console.log("Migrating orders...");
  const v1Orders = await v1Pool.query("SELECT * FROM orders ORDER BY id");

  for (const row of v1Orders.rows) {
    const newId = uuid();
    idMap.orders.set(row.id, newId);

    await v2Pool.query(
      `INSERT INTO orders (id, order_number, customer_id, status, priority,
        total_amount, notes, estimated_shipping_date, created_by_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        newId,
        row.order_number ?? `ORD-LEGACY-${row.id}`,
        idMap.customers.get(row.customer_id),
        mapOrderStatus(row.status),
        row.priority ?? "normal",
        row.total_amount ?? 0,
        row.notes,
        row.estimated_shipping_date,
        row.created_by ? idMap.users.get(row.created_by) : null,
        row.created_at,
        row.updated_at,
      ]
    );
  }
  console.log(`  ✅ ${v1Orders.rows.length} orders migrated`);
}

async function recalculateReservedStock() {
  console.log("Recalculating reserved stock...");
  // reserved_stock = sum of quantities from unpicked items in non-cancelled/shipped orders
  await v2Pool.query(`
    UPDATE products SET reserved_stock = COALESCE((
      SELECT SUM(oi.quantity)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = products.id
        AND oi.picked_at IS NULL
        AND o.status NOT IN ('shipped', 'cancelled')
    ), 0)
  `);
  console.log("  ✅ Reserved stock recalculated");
}

// ... additional migration functions for each table ...

function mapRole(v1Role: string): string {
  const roleMap: Record<string, string> = {
    admin: "admin",
    manager: "admin",
    office: "front_office",
    front_office: "front_office",
    warehouse: "warehouse",
    viewer: "viewer",
  };
  return roleMap[v1Role?.toLowerCase()] ?? "viewer";
}

function mapOrderStatus(v1Status: string): string {
  const statusMap: Record<string, string> = {
    new: "pending",
    pending: "pending",
    processing: "pending",
    picked: "picked",
    partially_shipped: "partially_shipped",
    shipped: "shipped",
    completed: "shipped",
    cancelled: "cancelled",
    canceled: "cancelled",
  };
  return statusMap[v1Status?.toLowerCase()] ?? "pending";
}

function printSummary() {
  console.log("\nMigration Summary:");
  for (const [table, map] of Object.entries(idMap)) {
    console.log(`  ${table}: ${map.size} records`);
  }
}

// Run
migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
```

### 2. Pre-Migration Validation — `scripts/validate-v1-data.ts`

```ts
// scripts/validate-v1-data.ts
// Run before migration to identify data quality issues

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.V1_DATABASE_URL });

async function validate() {
  console.log("=== V1 Data Validation ===\n");

  // Check for orphaned records
  const orphanedOrderItems = await pool.query(`
    SELECT COUNT(*) FROM "orderItems" oi
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE o.id IS NULL
  `);
  report("Orphaned order items", orphanedOrderItems.rows[0].count);

  // Check for duplicate SKUs
  const dupSkus = await pool.query(`
    SELECT sku, COUNT(*) FROM products
    GROUP BY sku HAVING COUNT(*) > 1
  `);
  report("Duplicate SKUs", dupSkus.rows.length, dupSkus.rows);

  // Check for orders without customers
  const noCustomer = await pool.query(`
    SELECT COUNT(*) FROM orders WHERE customer_id IS NULL
  `);
  report("Orders without customer", noCustomer.rows[0].count);

  // Check for negative stock
  const negStock = await pool.query(`
    SELECT id, name, current_stock FROM products WHERE current_stock < 0
  `);
  report("Products with negative stock", negStock.rows.length, negStock.rows);

  // Table row counts
  const tables = [
    "users", "products", "categories", "tags", "orders",
    "customers", "suppliers", "\"orderItems\"",
  ];
  console.log("\nTable sizes:");
  for (const table of tables) {
    const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`  ${table}: ${result.rows[0].count} rows`);
  }
}

function report(check: string, count: number, details?: any[]) {
  if (count > 0) {
    console.log(`⚠️  ${check}: ${count}`);
    if (details?.length) console.log(`   Details:`, details.slice(0, 5));
  } else {
    console.log(`✅ ${check}: OK`);
  }
}

validate()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
```

### 3. Post-Migration Verification — `scripts/verify-migration.ts`

```ts
// scripts/verify-migration.ts
import pg from "pg";

const v1Pool = new pg.Pool({ connectionString: process.env.V1_DATABASE_URL });
const v2Pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  console.log("=== Post-Migration Verification ===\n");

  const tables = [
    { v1: "users", v2: "users" },
    { v1: "products", v2: "products" },
    { v1: "categories", v2: "categories" },
    { v1: "orders", v2: "orders" },
    { v1: "customers", v2: "customers" },
    { v1: "\"orderItems\"", v2: "order_items" },
  ];

  let allMatch = true;
  for (const { v1, v2 } of tables) {
    const v1Count = (await v1Pool.query(`SELECT COUNT(*) FROM ${v1}`)).rows[0].count;
    const v2Count = (await v2Pool.query(`SELECT COUNT(*) FROM ${v2}`)).rows[0].count;
    const match = v1Count === v2Count;
    if (!match) allMatch = false;
    console.log(`${match ? "✅" : "❌"} ${v2}: V1=${v1Count} V2=${v2Count}`);
  }

  // Verify FK constraints are satisfied
  const fkCheck = await v2Pool.query(`
    SELECT oi.id FROM order_items oi
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE o.id IS NULL
    LIMIT 1
  `);
  console.log(fkCheck.rows.length === 0
    ? "✅ Foreign key integrity: OK"
    : "❌ Foreign key violations found"
  );

  // Verify reserved stock
  const stockCheck = await v2Pool.query(`
    SELECT COUNT(*) FROM products WHERE reserved_stock < 0
  `);
  console.log(stockCheck.rows[0].count === "0"
    ? "✅ Reserved stock non-negative: OK"
    : `❌ ${stockCheck.rows[0].count} products with negative reserved_stock`
  );

  console.log(allMatch ? "\n✅ All counts match!" : "\n⚠️  Some counts differ — review above");
}

verify()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
```

---

## Migration Runbook

```
1. Take V1 backup:           pg_dump $V1_DATABASE_URL > v1_final_backup.sql
2. Put V1 in maintenance:    Update V1 to show "maintenance" banner
3. Validate V1 data:         npx tsx scripts/validate-v1-data.ts
4. Run migration:            npx tsx scripts/migrate-v1-data.ts
5. Verify migration:         npx tsx scripts/verify-migration.ts
6. Smoke test V2:            Open V2, check orders/products/customers
7. Switch DNS:               Point domain to V2 Cloudflare Tunnel
8. Monitor for 24h:          Watch logs for errors
9. Decommission V1:          After 1 week with no issues
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `scripts/migrate-v1-data.ts` | Main migration script: V1 → V2 with ID remapping |
| `scripts/validate-v1-data.ts` | Pre-migration data quality checks |
| `scripts/verify-migration.ts` | Post-migration row count and FK verification |

---

## Verification

1. **Validate V1** — run validation script, confirm it identifies known data quality issues.
2. **Dry run** — run migration against a test V2 database, confirm no errors.
3. **Row counts** — compare V1 and V2 row counts for all tables.
4. **ID mapping** — confirm all FK references use correct V2 UUIDs.
5. **Reserved stock** — confirm `reservedStock` is recalculated correctly for active orders.
6. **Order totals** — confirm order `totalAmount` matches sum of line items.
7. **Role mapping** — confirm V1 roles are mapped to V2 role enum correctly.
8. **Status mapping** — confirm V1 order statuses are mapped to V2 status enum.
9. **Orphan handling** — confirm orphaned records in V1 are handled gracefully (skipped with log).
10. **Idempotent** — run migration twice, confirm it handles existing data (ON CONFLICT).

---

## Definition of Done

- [ ] Migration script transforms V1 data to V2 schema with UUID primary keys
- [ ] All FK relationships are maintained via ID mapping
- [ ] `reservedStock` is recalculated post-migration based on active order items
- [ ] Pre-migration validation identifies orphans, duplicates, and data quality issues
- [ ] Post-migration verification compares row counts between V1 and V2
- [ ] Order statuses and user roles are mapped to V2 enums
- [ ] Migration handles edge cases: null fields, missing FKs, duplicate SKUs
- [ ] Migration is idempotent (can be run multiple times safely)
- [ ] Runbook documents the full cutover procedure
- [ ] Migration script logs progress and summary for each table
