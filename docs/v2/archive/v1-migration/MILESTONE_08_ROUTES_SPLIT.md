# Milestone 08 — Split Monolithic routes.ts

**Priority:** P2
**Depends on:** Milestones 06, 07
**Blocks:** Nothing (maintainability improvement)

---

## Objective

Split the 5,374-line monolithic `routes.ts` into domain-scoped router modules. This makes the codebase maintainable, testable, and allows individual modules to be worked on independently.

---

## Current State

All 186 endpoints live in one file: `server/routes.ts`.

## Target Structure

```
server/
├── routes/
│   ├── index.ts           ← Assembles all routers, mounts them
│   ├── auth.ts            ← Login, logout, profile, users
│   ├── orders.ts          ← Orders CRUD + status + picking + labels
│   ├── products.ts        ← Products CRUD + images + search
│   ├── inventory.ts       ← Inventory adjustments + changes log
│   ├── customers.ts       ← Customers CRUD + history
│   ├── suppliers.ts       ← Suppliers + invoices + payments
│   ├── production.ts      ← Production orders + recipes + materials
│   ├── reports.ts         ← Analytics + dashboard stats
│   ├── settings.ts        ← Notification + email + company settings
│   ├── callLogs.ts        ← Call logs + prospective customers
│   ├── barcode.ts         ← Barcode lookup + scan logging
│   └── labels.ts          ← Shipping labels + templates
└── routes.ts              ← KEPT temporarily, removed once all routes migrated
```

---

## Step 1 — Create `server/routes/index.ts`

```typescript
// server/routes/index.ts
import { Express } from 'express';
import { isAuthenticated } from '../auth';

// Import domain routers
import authRouter from './auth';
import ordersRouter from './orders';
import productsRouter from './products';
import inventoryRouter from './inventory';
import customersRouter from './customers';
import suppliersRouter from './suppliers';
import productionRouter from './production';
import reportsRouter from './reports';
import settingsRouter from './settings';
import callLogsRouter from './callLogs';
import barcodeRouter from './barcode';
import labelsRouter from './labels';

export function registerRoutes(app: Express): void {
  // Public routes (no auth required)
  app.use('/api/auth', authRouter);

  // Protected routes (all require authentication)
  app.use('/api/orders', isAuthenticated, ordersRouter);
  app.use('/api/products', isAuthenticated, productsRouter);
  app.use('/api/inventory', isAuthenticated, inventoryRouter);
  app.use('/api/customers', isAuthenticated, customersRouter);
  app.use('/api/suppliers', isAuthenticated, suppliersRouter);
  app.use('/api/production', isAuthenticated, productionRouter);
  app.use('/api/reports', isAuthenticated, reportsRouter);
  app.use('/api/settings', isAuthenticated, settingsRouter);
  app.use('/api/call-logs', isAuthenticated, callLogsRouter);
  app.use('/api/barcode', isAuthenticated, barcodeRouter);
  app.use('/api/labels', isAuthenticated, labelsRouter);

  // Legacy aliases (keep for backwards compat during migration)
  // Remove once frontend is updated to use new paths
  app.use('/api/supplier-invoices', isAuthenticated, suppliersRouter);
  app.use('/api/supplier-payments', isAuthenticated, suppliersRouter);
}
```

---

## Step 2 — Example: `server/routes/orders.ts`

```typescript
// server/routes/orders.ts
import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { asyncHandler } from '../middlewares/errorHandler';
import { validateRequest } from '../utils/validation';
import { NotFoundError, ValidationError } from '../utils/errorUtils';
import { pickOrder, releaseReservation } from '../services/orderPickingService';
import { hasRole } from '../auth';
import { cache, CACHE_KEYS } from '../utils/cacheManager';

const router = Router();

// ============================================================
// GET /api/orders
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;

  const orders = await storage.getOrders(
    status as string | undefined
  );

  // Paginate
  const start = (Number(page) - 1) * Number(limit);
  const paged = orders.slice(start, start + Number(limit));

  res.json({
    success: true,
    data: paged,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: orders.length,
    },
  });
}));

// ============================================================
// GET /api/orders/:id
// ============================================================
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const order = await storage.getOrder(id);

  if (!order) {
    throw new NotFoundError(`Order ${id} not found`);
  }

  const items = await storage.getOrderItems(id);
  const changelogs = await storage.getOrderChangelogs(id);

  res.json({ success: true, data: { order, items, changelogs } });
}));

// ============================================================
// POST /api/orders
// ============================================================
router.post('/', asyncHandler(async (req, res) => {
  const userId = (req.user as any)?.id;
  const orderData = req.body;

  const newOrder = await storage.createOrder({
    ...orderData,
    createdById: userId,
  });

  // Invalidate relevant caches
  await cache.del(CACHE_KEYS.ORDERS_RECENT);
  await cache.del(CACHE_KEYS.DASHBOARD_STATS);

  res.status(201).json({ success: true, data: newOrder });
}));

// ============================================================
// PATCH /api/orders/:id/status — ORDER PICKING
// ============================================================
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = (req.user as any)?.id;
  const { status, itemQuantities } = req.body;

  // Validate status
  const validStatuses = ['pending', 'picked', 'shipped', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`);
  }

  // Order picking — use atomic transaction service
  if (status === 'picked' && itemQuantities?.length > 0) {
    const result = await pickOrder(
      id,
      itemQuantities.map((item: any) => ({
        orderItemId: item.orderItemId,
        productId: item.productId,
        requestedQuantity: item.requestedQuantity,
        actualQuantity: item.actualQuantity ?? item.requestedQuantity,
      })),
      userId
    );

    const updatedOrder = await storage.getOrder(id);
    return res.json({
      success: true,
      data: updatedOrder,
      stockChanges: result.stockChanges,
    });
  }

  // Order cancellation — release reserved stock
  if (status === 'cancelled') {
    await releaseReservation(id, userId);
    const updatedOrder = await storage.getOrder(id);
    return res.json({ success: true, data: updatedOrder });
  }

  // Other status updates (shipped, etc.)
  const updatedOrder = await storage.updateOrder(id, { status, updatedById: userId });
  res.json({ success: true, data: updatedOrder });
}));

// ============================================================
// DELETE /api/orders/:id
// ============================================================
router.delete('/:id', hasRole('admin'), asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  await releaseReservation(id, (req.user as any)?.id);
  await storage.deleteOrder(id);
  res.json({ success: true });
}));

export default router;
```

---

## Step 3 — Migration Strategy

Do NOT delete routes.ts all at once. Migrate one domain at a time:

```
Week 1: auth, products, inventory (lower risk)
Week 2: orders, customers
Week 3: suppliers, production, reports
Week 4: settings, callLogs, barcode, labels
Week 5: Delete old routes.ts
```

For each domain:
1. Create new `server/routes/domain.ts`
2. Register it in `server/routes/index.ts` alongside old routes
3. Test that old routes still work (temporarily duplicate)
4. Update frontend if any URL paths changed
5. Remove old routes from `routes.ts`
6. Delete remaining `routes.ts` when empty

---

## Verification

```bash
# After each domain migration:
# 1. Run the app
npm run dev

# 2. Check all endpoints for that domain still work
# Use the API audit tool that already exists:
node api_audit_analysis.cjs

# 3. Check no 404s on previously working routes
curl /api/products     # Should work
curl /api/orders       # Should work
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
└── server/
    ├── routes/
    │   ├── index.ts      ← NEW: Router assembly
    │   ├── auth.ts        ← NEW: Auth routes
    │   ├── orders.ts      ← NEW: Order routes (with picking fix)
    │   ├── products.ts    ← NEW: Product routes
    │   ├── inventory.ts   ← NEW: Inventory routes
    │   ├── customers.ts   ← NEW: Customer routes
    │   ├── suppliers.ts   ← NEW: Supplier routes
    │   ├── production.ts  ← NEW: Production routes
    │   ├── reports.ts     ← NEW: Reports routes
    │   ├── settings.ts    ← NEW: Settings routes
    │   ├── callLogs.ts    ← NEW: CRM routes
    │   ├── barcode.ts     ← NEW: Barcode routes
    │   └── labels.ts      ← NEW: Label routes
    ├── routes.ts          ← GRADUALLY EMPTIED → DELETED
    └── index.ts           ← MODIFIED: Use registerRoutes()
```

---

## Next Milestone

→ [MILESTONE_09_CI_CD.md](./MILESTONE_09_CI_CD.md) — GitHub Actions CI/CD pipeline
