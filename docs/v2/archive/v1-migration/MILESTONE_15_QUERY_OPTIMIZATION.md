# Milestone 15 — Query Optimization

**Priority:** P2
**Depends on:** Milestone 06 (Schema + indexes), Milestone 08 (Routes split), Milestone 14 (API standardization)
**Blocks:** Milestone 18 (Testing — test optimized queries)
**Execution order:** Run AFTER Milestone 14 (API standardization)

---

## Objective

Eliminate N+1 query patterns, push all filtering and pagination into the database, and fix the non-atomic `createOrder` two-step insert. The V1 codebase fetches entire tables into memory and filters/paginates in JavaScript — this will degrade badly under real production load.

---

## Problem Summary

| Issue | Location | Impact |
|---|---|---|
| N+1 on `GET /api/orders` | routes.ts:937 | 100 orders = 101 queries per request |
| N+1 on order detail (items → products) | routes.ts:1030 | 10 items = 11 queries per order |
| Full table load + JS filter for order search | routes.ts:1016 | All orders in memory for every search |
| Full table load + JS filter for customer history | routes.ts:2176 | All orders in memory |
| Application-level pagination for products | routes.ts:417 | All matching products loaded, then sliced |
| `efficientOrderQueries.ts` exists but not used | server/api/ | Good code sitting unused |
| `createOrder` is non-atomic (TEMP → real number) | storage.postgresql.ts:615 | Crash leaves orphan TEMP records |

---

## Step 1 — Fix `GET /api/orders` — Eliminate N+1

The efficient query module already exists at `server/api/efficientOrderQueries.ts`. It joins orders and items in a single query. It is only exposed at `/api/orders/efficient` which the frontend doesn't use.

**Action: Replace the N+1 implementation with the efficient one as the default.**

```typescript
// server/routes/orders.ts

// BEFORE (N+1 — 1 + N queries):
const orders = await storage.getAllOrders();
const ordersWithItems = await Promise.all(
  orders.map(async (order) => {
    const items = await storage.getOrderItems(order.id);
    return { ...order, items };
  })
);

// AFTER (2 queries total — orders + all their items in one IN query):
import { getOrdersWithItems } from '../api/efficientOrderQueries';

const result = await getOrdersWithItems(db, { status, page, limit });
res.json(paginated(result.orders, result.total, page, limit));
```

If `getOrdersWithItems` doesn't already handle pagination, update it to accept `page` and `limit` and apply `LIMIT`/`OFFSET` in SQL.

---

## Step 2 — Implement Efficient Order Queries

**File:** `server/api/efficientOrderQueries.ts`

Ensure the following functions exist and are exported. Update or create as needed:

```typescript
// server/api/efficientOrderQueries.ts
import { db } from '../db';
import { orders, orderItems, products } from '../../shared/schema';
import { eq, inArray, ilike, and, desc, sql } from 'drizzle-orm';

interface GetOrdersOptions {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;        // customer name or order number
  customerId?: number;
}

interface OrdersResult {
  orders: OrderWithItems[];
  total: number;
}

export async function getOrdersWithItems(
  options: GetOrdersOptions = {}
): Promise<OrdersResult> {
  const { status, page = 1, limit = 50, search, customerId } = options;

  // Build WHERE conditions
  const conditions = [];
  if (status) conditions.push(eq(orders.status, status));
  if (search) {
    conditions.push(
      sql`(${orders.customerName} ILIKE ${`%${search}%`} OR ${orders.orderNumber} ILIKE ${`%${search}%`})`
    );
  }
  if (customerId) conditions.push(eq(orders.customerId, customerId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Query 1: Count total (for pagination)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);

  // Query 2: Orders with pagination
  const ordersResult = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.orderDate))
    .limit(limit)
    .offset((page - 1) * limit);

  if (ordersResult.length === 0) {
    return { orders: [], total: count };
  }

  // Query 3: All items for these orders (single IN query — not N queries)
  const orderIds = ordersResult.map(o => o.id);
  const itemsResult = await db
    .select({
      item: orderItems,
      productName: products.name,
      productSku: products.sku,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(inArray(orderItems.orderId, orderIds));

  // Group items by orderId in memory (small dataset — just the items for this page)
  const itemsByOrderId = new Map<number, any[]>();
  for (const row of itemsResult) {
    const existing = itemsByOrderId.get(row.item.orderId) ?? [];
    existing.push({ ...row.item, productName: row.productName, productSku: row.productSku });
    itemsByOrderId.set(row.item.orderId, existing);
  }

  const ordersWithItems = ordersResult.map(order => ({
    ...order,
    items: itemsByOrderId.get(order.id) ?? [],
  }));

  return { orders: ordersWithItems, total: count };
}

// Single order with items (efficient version)
export async function getOrderById(id: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;

  const items = await db
    .select({
      item: orderItems,
      productName: products.name,
      productSku: products.sku,
      productCurrentStock: products.currentStock,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, id));

  return {
    ...order,
    items: items.map(r => ({ ...r.item, productName: r.productName, productSku: r.productSku })),
  };
}
```

**Total queries for `GET /api/orders?page=1&limit=50`:**
- Before: 1 (all orders) + 50 (items per order) = **51 queries**
- After: 1 (count) + 1 (orders page) + 1 (all items for page) = **3 queries**

---

## Step 3 — Fix `/api/orders/search` — Push Filter to SQL

```typescript
// BEFORE (full table load + JS filter):
const allOrders = await storage.getAllOrders();
const filtered = allOrders.filter(o =>
  o.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
  o.customerName.toLowerCase().includes(query.toLowerCase())
);

// AFTER (SQL ILIKE):
const result = await getOrdersWithItems({ search: query, page, limit });
res.json(paginated(result.orders, result.total, page, limit));
```

---

## Step 4 — Fix Products — Push Pagination to SQL

**File:** `server/storage.postgresql.ts` → `server/routes/products.ts`

```typescript
// BEFORE (all results loaded, then sliced in app):
const products = await storage.searchProducts(q, tag, stockStatus);
const paginatedProducts = products.slice(startIndex, endIndex);

// AFTER — add page/limit to storage.searchProducts:
async searchProducts(
  query?: string,
  tag?: string,
  stockStatus?: string,
  page = 1,
  limit = 50
): Promise<{ products: Product[]; total: number }> {
  const conditions = [];

  if (query) {
    conditions.push(
      sql`(${products.name} ILIKE ${`%${query}%`} OR ${products.sku} ILIKE ${`%${query}%`})`
    );
  }
  if (tag) {
    conditions.push(sql`${tag} = ANY(${products.tags})`);
  }
  if (stockStatus === 'low') {
    conditions.push(sql`${products.currentStock} <= ${products.minStockLevel}`);
  }
  if (stockStatus === 'out') {
    conditions.push(eq(products.currentStock, 0));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ count }] = await this.db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  const rows = await this.db
    .select()
    .from(products)
    .where(where)
    .orderBy(products.name)
    .limit(limit)
    .offset((page - 1) * limit);

  return { products: rows, total: count };
}
```

---

## Step 5 — Fix `createOrder` — Make It Atomic

**File:** `server/storage.postgresql.ts` (lines ~615–647)

The current two-step insert (insert with `TEMP` orderNumber, then update with real number) leaves orphan records on crash.

```typescript
// BEFORE (non-atomic — crashes leave TEMP records):
const [tempOrder] = await this.db.insert(orders).values({ orderNumber: 'TEMP', ... }).returning();
const orderNumber = `ORD-${String(tempOrder.id).padStart(6, '0')}`;
const [order] = await this.db.update(orders).set({ orderNumber }).where(eq(orders.id, tempOrder.id)).returning();

// AFTER (single atomic insert — generate orderNumber from the returned id in a CTE):
async createOrder(data: InsertOrder): Promise<Order> {
  // Use a CTE (WITH clause) to insert and compute orderNumber in one statement:
  const [order] = await this.db.execute<Order>(sql`
    WITH inserted AS (
      INSERT INTO orders (customer_name, customer_id, status, notes, created_by_id, order_date)
      VALUES (
        ${data.customerName},
        ${data.customerId ?? null},
        ${'pending'},
        ${data.notes ?? null},
        ${data.createdById ?? null},
        NOW()
      )
      RETURNING *
    )
    UPDATE orders
    SET order_number = 'ORD-' || LPAD(inserted.id::text, 6, '0')
    FROM inserted
    WHERE orders.id = inserted.id
    RETURNING orders.*
  `);

  return order;
}
```

Alternatively, use a PostgreSQL sequence or a `GENERATED ALWAYS` computed column if the schema allows. The key requirement is that `orderNumber` is set in the same transaction as the insert.

---

## Step 6 — Fix Customer History — Push Filter to SQL

```typescript
// BEFORE (all orders loaded, filtered in JS):
const allOrders = await storage.getAllOrders();
const customerOrders = allOrders.filter(o => o.customerId === customerId);

// AFTER (WHERE clause):
const customerOrders = await db
  .select()
  .from(orders)
  .where(eq(orders.customerId, customerId))
  .orderBy(desc(orders.orderDate))
  .limit(50);
```

---

## Verification

```bash
# 1. Enable PostgreSQL query logging to count queries per request:
# In docker-compose.yml, add to postgres command:
# command: postgres -c log_min_duration_statement=0

# 2. Watch logs while loading the orders page:
docker compose logs postgres -f

# 3. Load /api/orders — count SELECT statements in pg logs:
curl -s http://localhost:5000/api/orders?page=1&limit=50
# Before: 51+ SELECT statements
# After: 3 SELECT statements

# 4. Test search works via SQL:
curl -s "http://localhost:5000/api/orders?search=Smith"
# Should return filtered results

# 5. Test pagination is server-side:
curl -s "http://localhost:5000/api/orders?page=2&limit=10"
# Should return items 11-20, with pagination.total reflecting the full count

# 6. Verify no TEMP orders exist after app restart:
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT id, order_number FROM orders WHERE order_number = 'TEMP';"
# Expected: 0 rows
```

---

## Files Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── api/
│   │   └── efficientOrderQueries.ts  ← MODIFIED: Add pagination, search, export for use
│   ├── routes/
│   │   ├── orders.ts                 ← MODIFIED: Use efficientOrderQueries
│   │   ├── products.ts               ← MODIFIED: SQL pagination
│   │   └── customers.ts              ← MODIFIED: SQL filter for history
│   └── storage.postgresql.ts         ← MODIFIED: searchProducts pagination + atomic createOrder
```

---

## Next Milestone

→ [MILESTONE_17_SHARED_TYPE_CLEANUP.md](./MILESTONE_17_SHARED_TYPE_CLEANUP.md) — Eliminate type:any, fix role mismatch, remove .bak files
