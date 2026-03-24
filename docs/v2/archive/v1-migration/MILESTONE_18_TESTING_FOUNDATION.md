# Milestone 18 — Testing Foundation

**Priority:** P2
**Depends on:** Milestone 13 (Auth), Milestone 14 (API standardization), Milestone 15 (Query optimization), Milestone 17 (Types)
**Blocks:** Milestone 09 (CI/CD — the pipeline should run tests)
**Execution order:** Run AFTER Milestone 17, BEFORE Milestone 09 (CI/CD)

---

## Objective

Introduce Vitest as the test framework and write integration tests covering the three highest-risk areas: the order lifecycle state machine, the stock picking transaction (race condition coverage), and supplier payment validation (database trigger testing). Add a typecheck + test step to the CI pipeline.

The goal is not 100% coverage — it's to cover the code paths that, if broken, would cause real financial or inventory damage.

---

## Why These Tests First

| Test Area | Risk if Untested |
|---|---|
| Order lifecycle (pending → picked → shipped → cancelled) | Wrong stock levels, corrupted audit trail |
| Stock picking transaction | Race condition leaves stock negative |
| Stock reservation (order create/cancel) | Over-committing stock to pending orders |
| Supplier payment trigger | Invoice overpayment allowed at DB level |
| Auth middleware coverage | API accidentally left public |

---

## Step 1 — Install Vitest

```bash
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest

# For integration tests that need a real DB:
npm install -D @testcontainers/postgresql testcontainers
```

**Add to `package.json`:**
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

---

## Step 2 — Configure Vitest

**File:** `vitest.config.ts`

```typescript
// vitest.config.ts — unit tests (no DB)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.ts', 'shared/**/*.ts'],
      exclude: ['server/index.ts', '**/*.d.ts'],
    },
  },
});
```

**File:** `vitest.integration.config.ts`

```typescript
// vitest.integration.config.ts — integration tests (real postgres via testcontainers)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60000,   // Testcontainers needs time to start postgres
    hookTimeout: 60000,
    maxConcurrency: 1,    // Integration tests must run serially (shared DB state)
    sequence: {
      shuffle: false,
    },
  },
});
```

---

## Step 3 — Test Infrastructure Setup

**File:** `tests/integration/setup.ts`

```typescript
// tests/integration/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from '../../shared/schema';

let container: PostgreSqlContainer;
let testDb: ReturnType<typeof drizzle>;
let pool: pg.Pool;

export async function setupTestDatabase() {
  container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('amphoreus_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
  });

  testDb = drizzle(pool, { schema });

  // Run migrations to set up schema
  await pool.query(`
    -- Apply your schema SQL here or run migration file
    -- Simplified: just run the init migration
  `);

  return testDb;
}

export async function teardownTestDatabase() {
  await pool.end();
  await container.stop();
}

export async function cleanDatabase(db: typeof testDb) {
  // Delete all rows between tests (faster than recreating the DB)
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.products);
  await db.delete(schema.categories);
  await db.delete(schema.users);
  await db.delete(schema.customers);
  await db.delete(schema.supplierPayments);
  await db.delete(schema.supplierInvoices);
  await db.delete(schema.suppliers);
}
```

---

## Step 4 — Order Lifecycle Tests

**File:** `tests/integration/orderLifecycle.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from './setup';
import { pickOrder, reserveStockForOrder, releaseReservation } from '../../server/services/orderPickingService';
import { db } from '../../server/db'; // will be overridden in tests

describe('Order Lifecycle', () => {
  let testDb: any;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase(testDb);
  });

  // ============================================================
  // Helpers
  // ============================================================
  async function createTestCategory() {
    const [cat] = await testDb.insert(schema.categories)
      .values({ name: 'Test Category' })
      .returning();
    return cat;
  }

  async function createTestProduct(currentStock = 100) {
    const cat = await createTestCategory();
    const [product] = await testDb.insert(schema.products)
      .values({
        name: 'Test Product',
        sku: `SKU-${Date.now()}`,
        categoryId: cat.id,
        currentStock,
        reservedStock: 0,
        minStockLevel: 10,
      })
      .returning();
    return product;
  }

  async function createTestOrder(productId: number, quantity: number) {
    const [order] = await testDb.insert(schema.orders)
      .values({
        orderNumber: `ORD-${Date.now()}`,
        customerName: 'Test Customer',
        status: 'pending',
      })
      .returning();

    const [item] = await testDb.insert(schema.orderItems)
      .values({ orderId: order.id, productId, quantity, unitPrice: '10.00' })
      .returning();

    return { order, item };
  }

  // ============================================================
  // Test: Stock reservation on order creation
  // ============================================================
  it('reserves stock when an order is created', async () => {
    const product = await createTestProduct(100);
    await reserveStockForOrder(
      [{ productId: product.id, quantity: 10 }],
      testDb
    );

    const [updated] = await testDb.select()
      .from(schema.products)
      .where(eq(schema.products.id, product.id));

    expect(updated.currentStock).toBe(100);   // physical stock unchanged
    expect(updated.reservedStock).toBe(10);    // reservation made
  });

  // ============================================================
  // Test: Stock deduction on picking
  // ============================================================
  it('deducts stock and clears reservation when order is picked', async () => {
    const product = await createTestProduct(100);
    const { order, item } = await createTestOrder(product.id, 10);

    await reserveStockForOrder(
      [{ productId: product.id, quantity: 10 }],
      testDb
    );

    await pickOrder(
      order.id,
      [{ orderItemId: item.id, productId: product.id, requestedQuantity: 10, actualQuantity: 10 }],
      1 // userId
    );

    const [updated] = await testDb.select()
      .from(schema.products)
      .where(eq(schema.products.id, product.id));

    expect(updated.currentStock).toBe(90);    // physically deducted
    expect(updated.reservedStock).toBe(0);    // reservation cleared
  });

  // ============================================================
  // Test: Cancellation releases reservation
  // ============================================================
  it('releases reservation when order is cancelled', async () => {
    const product = await createTestProduct(100);
    const { order } = await createTestOrder(product.id, 10);

    await reserveStockForOrder(
      [{ productId: product.id, quantity: 10 }],
      testDb
    );

    await releaseReservation(order.id, 1);

    const [updated] = await testDb.select()
      .from(schema.products)
      .where(eq(schema.products.id, product.id));

    expect(updated.currentStock).toBe(100);   // physical stock unchanged
    expect(updated.reservedStock).toBe(0);    // reservation released
  });

  // ============================================================
  // Test: Race condition — two concurrent picks
  // ============================================================
  it('handles concurrent picks without negative stock (SELECT FOR UPDATE)', async () => {
    const product = await createTestProduct(10);  // Only 10 units
    const { order: order1, item: item1 } = await createTestOrder(product.id, 10);
    const { order: order2, item: item2 } = await createTestOrder(product.id, 10);

    // Reserve for both (total reserved = 20, but only 10 physical stock)
    // In V2, reservation should fail for the second order due to CHECK constraint
    await reserveStockForOrder([{ productId: product.id, quantity: 10 }], testDb);

    // Second reservation should fail: reserved_stock would exceed current_stock
    await expect(
      reserveStockForOrder([{ productId: product.id, quantity: 10 }], testDb)
    ).rejects.toThrow(); // CHECK constraint: reserved_stock <= current_stock

    // Or: if we allow double-reservation during order creation,
    // ensure the second PICK fails when stock is 0:
    await pickOrder(order1.id, [{ orderItemId: item1.id, productId: product.id, requestedQuantity: 10, actualQuantity: 10 }], 1);

    await expect(
      pickOrder(order2.id, [{ orderItemId: item2.id, productId: product.id, requestedQuantity: 10, actualQuantity: 10 }], 1)
    ).rejects.toThrow(); // Should fail — stock is now 0
  });

  // ============================================================
  // Test: Stock never goes negative
  // ============================================================
  it('throws if picking would make stock negative', async () => {
    const product = await createTestProduct(5); // Only 5 units
    const { order, item } = await createTestOrder(product.id, 10); // Request 10

    await expect(
      pickOrder(
        order.id,
        [{ orderItemId: item.id, productId: product.id, requestedQuantity: 10, actualQuantity: 10 }],
        1
      )
    ).rejects.toThrow(); // DB CHECK constraint: current_stock >= 0
  });
});
```

---

## Step 5 — Supplier Payment Tests

**File:** `tests/integration/supplierPayments.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from './setup';

describe('Supplier Payments', () => {
  let testDb: any;
  // ... setup/teardown omitted for brevity (same pattern as above)

  it('prevents payment exceeding invoice amount (DB trigger)', async () => {
    // Create supplier + invoice for 1000
    const [supplier] = await testDb.insert(schema.suppliers)
      .values({ name: 'Test Supplier', email: 'test@example.com' })
      .returning();

    const [invoice] = await testDb.insert(schema.supplierInvoices)
      .values({ supplierId: supplier.id, amount: '1000.00', status: 'pending' })
      .returning();

    // Pay 600 — should succeed
    await testDb.insert(schema.supplierPayments)
      .values({ invoiceId: invoice.id, amount: '600.00', paymentDate: new Date() });

    // Pay 500 more (600 + 500 = 1100 > 1000) — should fail at DB level
    await expect(
      testDb.insert(schema.supplierPayments)
        .values({ invoiceId: invoice.id, amount: '500.00', paymentDate: new Date() })
    ).rejects.toThrow(/exceed invoice balance/);
  });

  it('auto-updates invoice status to paid when fully paid', async () => {
    const [supplier] = await testDb.insert(schema.suppliers)
      .values({ name: 'Test Supplier 2', email: 'test2@example.com' })
      .returning();

    const [invoice] = await testDb.insert(schema.supplierInvoices)
      .values({ supplierId: supplier.id, amount: '500.00', status: 'pending' })
      .returning();

    await testDb.insert(schema.supplierPayments)
      .values({ invoiceId: invoice.id, amount: '500.00', paymentDate: new Date() });

    const [updated] = await testDb.select()
      .from(schema.supplierInvoices)
      .where(eq(schema.supplierInvoices.id, invoice.id));

    expect(updated.status).toBe('paid');
    expect(Number(updated.paidAmount)).toBe(500);
  });
});
```

---

## Step 6 — Auth Middleware Tests

**File:** `tests/integration/auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../server/app'; // Needs app to be exported separately from index.ts

describe('Authentication Middleware', () => {
  const app = createApp();
  const request = supertest(app);

  // These should all return 401 without a session:
  const protectedEndpoints = [
    ['GET', '/api/orders'],
    ['GET', '/api/customers'],
    ['GET', '/api/products'],
    ['GET', '/api/dashboard/stats'],
    ['POST', '/api/orders'],
    ['POST', '/api/products'],
    ['DELETE', '/api/orders/1'],
  ];

  for (const [method, path] of protectedEndpoints) {
    it(`${method} ${path} returns 401 without auth`, async () => {
      const res = await request[method.toLowerCase()](path);
      expect(res.status).toBe(401);
    });
  }

  // Debug endpoints should be 404 (deleted):
  it('GET /api/debug/notification-settings returns 404 (deleted)', async () => {
    const res = await request.get('/api/debug/notification-settings');
    expect(res.status).toBe(404);
  });
});
```

This requires the Express app to be exportable. Refactor `server/index.ts`:

```typescript
// server/app.ts — just the app, no listen()
import express from 'express';
// ... all middleware setup ...
export function createApp() {
  const app = express();
  // ... setup middleware, routes ...
  return app;
}

// server/index.ts — just starts the server
import { createApp } from './app';
const app = createApp();
app.listen(PORT, () => { ... });
```

---

## Step 7 — Unit Tests for Validation Logic

**File:** `tests/unit/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { insertProductSchema, updateProductSchema } from '../../shared/schema';

describe('Product validation', () => {
  it('requires SKU to be uppercase', () => {
    const result = insertProductSchema.safeParse({
      name: 'Test',
      sku: 'abc-123',
      categoryId: 1,
      currentStock: 0,
      minStockLevel: 10,
    });
    // SKU should be uppercased in route handler, schema should accept lowercase input
    expect(result.success).toBe(true);
  });

  it('rejects negative stock', () => {
    const result = insertProductSchema.safeParse({
      name: 'Test',
      sku: 'ABC-123',
      categoryId: 1,
      currentStock: -1, // invalid
      minStockLevel: 10,
    });
    expect(result.success).toBe(false);
  });

  it('does not clear SKU when updating other fields', () => {
    const result = updateProductSchema.safeParse({
      name: 'Updated Name',
      // sku not included — should not be set to null
    });
    expect(result.success).toBe(true);
    expect(result.data?.sku).toBeUndefined(); // omitted, not null
  });
});
```

---

## Step 8 — Wire Tests into CI/CD

**File:** `.github/workflows/deploy.yml` (Milestone 09)

Add a test job that runs before deploy:

```yaml
  test:
    name: Test & Type Check
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: amphoreus_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test          # unit tests
      - run: npm run test:integration  # integration tests (uses postgres service above)
        env:
          TEST_DATABASE_URL: postgresql://test:test@localhost:5432/amphoreus_test
```

---

## Test Directory Structure

```
amphoreus-v2/
└── tests/
    ├── unit/
    │   ├── validation.test.ts        ← Zod schema tests
    │   ├── cacheManager.test.ts      ← Cache logic tests
    │   └── apiResponse.test.ts       ← Response helper tests
    └── integration/
        ├── setup.ts                  ← Testcontainers DB setup
        ├── orderLifecycle.test.ts    ← Order state machine
        ├── supplierPayments.test.ts  ← Payment trigger tests
        └── auth.test.ts              ← Auth middleware coverage
```

---

## Verification

```bash
# Run unit tests:
npm run test
# Expected: all pass

# Run integration tests (requires Docker for testcontainers):
npm run test:integration
# Expected: all pass

# Run with coverage:
npm run test:coverage
# Target: >60% coverage of server/services/ and shared/schema.ts

# Verify CI pipeline runs tests:
git push origin main
# Check GitHub Actions — test job should appear before deploy job
```

---

## Files Created in This Milestone

```
amphoreus-v2/
├── vitest.config.ts                          ← NEW
├── vitest.integration.config.ts              ← NEW
├── tests/
│   ├── unit/
│   │   └── validation.test.ts                ← NEW
│   └── integration/
│       ├── setup.ts                          ← NEW
│       ├── orderLifecycle.test.ts            ← NEW
│       ├── supplierPayments.test.ts          ← NEW
│       └── auth.test.ts                      ← NEW
└── server/
    └── app.ts                                ← NEW: App factory (extracted from index.ts)
```

---

## Next Milestone

→ [MILESTONE_09_CI_CD.md](./MILESTONE_09_CI_CD.md) — GitHub Actions CI/CD (now runs tests before deploying)
