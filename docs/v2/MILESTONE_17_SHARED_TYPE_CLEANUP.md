# Milestone 17 — Shared Type Cleanup

**Priority:** P3
**Depends on:** Milestone 14 (API standardization — types must match stable API shapes)
**Blocks:** Milestone 18 (Testing — tests need correct types)
**Execution order:** Run AFTER Milestone 14 (API standardization)

---

## Objective

Eliminate the `as any` pattern throughout the codebase, fix the frontend `'manager'` role mismatch, create a single source-of-truth for shared types across frontend and backend, augment the Express `Request` type to properly type `req.user`, and delete committed `.bak` files.

---

## Problem Summary

| Issue | Location | Impact |
|---|---|---|
| `req.user as any` used 10+ times | routes.ts | No type safety on user session properties |
| 192 `any` usages in `routes.ts` | routes.ts | TypeScript can't catch bugs |
| 51 `any` usages in `storage.postgresql.ts` | storage | Silent type errors in DB layer |
| `'manager'` role in frontend, not in backend | AuthContext.tsx, schema.ts | Permission checks silently fail |
| Order types redefined per component | 5+ components | Types drift and diverge from DB schema |
| 5 `.bak` files committed | client/src/ | Dead code in repo |
| `storage.db` accessed directly in efficientOrderQueries | efficientOrderQueries.ts | Breaks storage abstraction |

---

## Step 1 — Augment Express Request Type (Eliminate `req.user as any`)

**File:** `server/types.d.ts`

Add a proper Passport user type to the Express namespace:

```typescript
// server/types.d.ts
import { InferSelectModel } from 'drizzle-orm';
import { users } from '../shared/schema';

// The shape of the user object passport puts on req.user
export type AuthUser = Pick<InferSelectModel<typeof users>, 'id' | 'username' | 'role' | 'fullName'>;

declare global {
  namespace Express {
    // Augment the Express Request interface
    interface User extends AuthUser {}
  }
}
```

Now throughout all route handlers, replace:
```typescript
// BEFORE (no type safety):
const userId = (req.user as any)?.id;
const userRole = (req.user as any)?.role;

// AFTER (fully typed):
const userId = req.user!.id;       // number
const userRole = req.user!.role;   // 'admin' | 'front_office' | 'warehouse'
```

---

## Step 2 — Fix the Role Mismatch

**File:** `shared/schema.ts`

```typescript
// Current (V1):
role: text('role').notNull().default('front_office')
// Implicit allowed values: admin, front_office, warehouse

// V2 — add explicit enum constraint:
export const userRoles = ['admin', 'front_office', 'warehouse'] as const;
export type UserRole = typeof userRoles[number];

// In schema:
role: text('role', { enum: userRoles }).notNull().default('front_office'),
```

**File:** `client/src/context/AuthContext.tsx`

```typescript
// BEFORE (has 'manager' which doesn't exist in backend):
role: 'admin' | 'manager' | 'front_office' | 'warehouse';

// AFTER (import from shared):
import type { UserRole } from '@shared/schema';
// UserRole = 'admin' | 'front_office' | 'warehouse'
```

**Verify all `hasRole('manager')` calls:**
```bash
grep -rn "manager" client/src/ server/ --include="*.ts" --include="*.tsx"
# Fix any role checks using 'manager' — they were silently failing
```

---

## Step 3 — Create Shared Domain Types

Instead of each component defining its own `Order`, `Product`, `Customer` interface that drifts from the DB schema, derive types from the Drizzle schema directly.

**File:** `shared/types.ts`

```typescript
// shared/types.ts
// All types derived from the Drizzle schema — single source of truth

import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  orders, orderItems, products, customers, suppliers,
  supplierInvoices, supplierPayments, categories, users,
  inventoryChanges, productionOrders, callLogs,
} from './schema';

// Select types (reading from DB)
export type Order = InferSelectModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type Product = InferSelectModel<typeof products>;
export type Customer = InferSelectModel<typeof customers>;
export type Supplier = InferSelectModel<typeof suppliers>;
export type SupplierInvoice = InferSelectModel<typeof supplierInvoices>;
export type SupplierPayment = InferSelectModel<typeof supplierPayments>;
export type Category = InferSelectModel<typeof categories>;
export type User = InferSelectModel<typeof users>;
export type InventoryChange = InferSelectModel<typeof inventoryChanges>;
export type ProductionOrder = InferSelectModel<typeof productionOrders>;
export type CallLog = InferSelectModel<typeof callLogs>;

// Insert types (writing to DB)
export type InsertOrder = InferInsertModel<typeof orders>;
export type InsertProduct = InferInsertModel<typeof products>;
export type InsertCustomer = InferInsertModel<typeof customers>;
// ... etc

// Composite types (server builds these, clients receive them)
export interface OrderWithItems extends Order {
  items: (OrderItem & {
    productName: string | null;
    productSku: string | null;
  })[];
}

export interface ProductWithCategory extends Product {
  categoryName: string | null;
}

// Re-export role type
export type { UserRole } from './schema';
```

---

## Step 4 — Update Frontend Components to Use Shared Types

Replace locally-defined interfaces with imports from `shared/types.ts`:

```typescript
// BEFORE (in Orders.tsx — local definition that drifts from DB):
interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  status: 'pending' | 'picked' | 'shipped' | 'cancelled'; // missing 'partially_shipped'!
  // ...
}

// AFTER:
import type { Order, OrderWithItems } from '@shared/types';
// Type is now always in sync with the DB schema
```

**Files to update:**
```bash
# Find all local Order/Product/Customer type definitions in frontend:
grep -rn "interface Order\|interface Product\|interface Customer\|type Order " \
  client/src/ --include="*.tsx" --include="*.ts"
```

Common offenders:
- `client/src/pages/Orders.tsx`
- `client/src/components/orders/OrderForm.tsx`
- `client/src/components/orders/RecentOrders.tsx`
- `client/src/pages/Products.tsx`
- `client/src/pages/Customers.tsx`

---

## Step 5 — Fix `storage.db` Abstraction Leak

**File:** `server/api/efficientOrderQueries.ts`

The efficient queries module accesses `storage.db` directly, which breaks the storage abstraction:

```typescript
// BEFORE (line ~54 — reaches into implementation):
const ordersQuery = storage.db  // IStorage doesn't have .db

// AFTER — pass db directly (it's an implementation detail, not part of IStorage):
import { db } from '../db';

// Functions use db directly — they are data access functions, not storage methods
export async function getOrdersWithItems(options: GetOrdersOptions) {
  // use db directly
}
```

This is cleaner than pretending these are part of the storage abstraction. They are Drizzle-specific optimized queries, not part of `IStorage`.

---

## Step 6 — Delete `.bak` Files

```bash
# Delete all committed backup files:
git rm client/src/components/orders/OrderForm.tsx.bak
git rm client/src/components/orders/OrderForm.tsx.bak2
git rm client/src/components/call-logs/CallLogForm.tsx.bak
git rm client/src/pages/Products.tsx.bak
git rm client/src/pages/Settings.tsx.bak
```

Add to `.gitignore` to prevent future .bak files:
```bash
# Add to .gitignore:
*.bak
*.bak2
*.backup
```

---

## Step 7 — Reduce `any` in Storage Layer

**File:** `server/storage.postgresql.ts`

```bash
# Count current any usage:
grep -c ": any\|as any\|<any>" server/storage.postgresql.ts
```

Common patterns to fix:

```typescript
// BEFORE:
async getOrders(status?: any): Promise<any[]> {

// AFTER:
import type { Order } from '../shared/types';
async getOrders(status?: string): Promise<Order[]> {

// BEFORE:
} catch (error: any) {
  console.error(error.message);

// AFTER:
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Storage error', { message });
  throw error;
}
```

---

## Verification

```bash
# 1. Type check — target: zero errors
npm run typecheck

# 2. Check remaining `any` count (set a target and track it):
echo "any count in routes:"; grep -c "as any\|: any" server/routes/
echo "any count in storage:"; grep -c "as any\|: any" server/storage.postgresql.ts

# 3. Verify no 'manager' role references remain:
grep -rn "'manager'" client/src/ server/
# Expected: 0 results

# 4. Verify .bak files are gone:
find . -name "*.bak" -o -name "*.bak2" | grep -v node_modules
# Expected: no results

# 5. Check all order components import from @shared/types not local interfaces:
grep -rn "interface Order\b" client/src/
# Expected: 0 results (all should import from @shared)
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── types.d.ts                    ← MODIFIED: Augment Express.User
│   ├── routes/*.ts                   ← MODIFIED: Remove req.user as any
│   └── api/efficientOrderQueries.ts  ← MODIFIED: Use db directly, not storage.db
├── shared/
│   ├── schema.ts                     ← MODIFIED: Add userRoles const + UserRole type
│   └── types.ts                      ← NEW: All domain types derived from schema
└── client/
    └── src/
        ├── context/AuthContext.tsx   ← MODIFIED: Import UserRole from shared
        ├── pages/Orders.tsx          ← MODIFIED: Import Order from shared
        ├── pages/Products.tsx        ← MODIFIED: Import Product from shared (+ delete .bak)
        ├── pages/Customers.tsx       ← MODIFIED: Import Customer from shared
        ├── pages/Settings.tsx        ← MODIFIED: (+ delete .bak)
        └── components/orders/
            ├── OrderForm.tsx         ← MODIFIED: Import types from shared (+ delete .bak, .bak2)
            └── RecentOrders.tsx      ← MODIFIED: Import Order from shared
```

---

## Next Milestone

→ [MILESTONE_18_TESTING_FOUNDATION.md](./MILESTONE_18_TESTING_FOUNDATION.md) — Add Vitest and write integration tests for critical paths
