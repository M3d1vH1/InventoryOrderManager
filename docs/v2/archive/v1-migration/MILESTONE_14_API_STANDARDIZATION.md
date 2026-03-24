# Milestone 14 — API Response Standardization

**Priority:** P2
**Depends on:** Milestone 08 (Routes split — standardize after splitting)
**Blocks:** Milestone 17 (Type cleanup), Milestone 18 (Testing)
**Execution order:** Run AFTER Milestone 08 (routes split), BEFORE Milestone 15 (query optimization)

---

## Objective

The V1 API has three different response shapes used inconsistently across 186 endpoints. The frontend papers over this with `select: (data: any) => ...` callbacks. This milestone enforces a single response shape across all endpoints, removes duplicate route registrations, and fixes HTTP method violations.

---

## Problem Summary

### Three Response Shapes Currently In Use

```typescript
// Shape A — newer endpoints (products, some orders):
{ success: true, data: product }
{ success: true, data: products, pagination: { page, limit, total } }
{ success: false, message: "Not found" }

// Shape B — older order endpoints (return object directly):
res.json(order)                  // just the object
res.json(orders)                 // just the array

// Shape C — mixed:
res.json({ order, warning: null })
res.json({ success: true, items })
```

Frontend consequence — every query has to guess the shape:
```typescript
// From Orders.tsx — shouldn't need this:
select: (data: any) => {
  if (data && typeof data === 'object' && 'data' in data) return data.data;
  return Array.isArray(data) ? data : [];
}
```

### Duplicate Route Registrations

- `POST /api/users` registered at line 2887 AND line 3794 (second has no Zod validation)
- `GET/POST/DELETE /api/users` registered twice
- `/api/order-errors` and `/api/order-quality` are complete duplicates pointing to same handlers

---

## Step 1 — Define the Standard Response Shape

```typescript
// server/utils/apiResponse.ts
// Single source of truth for all API response shapes

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export function created<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

// Types (also export these for frontend use in shared/):
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ErrorResponse {
  success: false;
  message: string;
  code?: string;        // Machine-readable error code e.g. "NOT_FOUND", "VALIDATION_ERROR"
  errors?: Record<string, string[]>;  // Field-level validation errors
}
```

Move the type definitions to `shared/apiTypes.ts` so the frontend can import them too:
```typescript
// shared/apiTypes.ts
export type { ApiResponse, PaginatedResponse, ErrorResponse } from '../server/utils/apiResponse';
```

---

## Step 2 — Standardize Error Responses

**File:** `server/middlewares/errorHandler.ts`

All error responses must use `ErrorResponse` shape. Update the global error handler:

```typescript
// Error response helper
export function errorResponse(
  res: Response,
  status: number,
  message: string,
  code?: string,
  errors?: Record<string, string[]>
): void {
  res.status(status).json({
    success: false,
    message,
    code,
    errors,
  } satisfies ErrorResponse);
}

// In the global error handler (asyncHandler catches feed here):
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof NotFoundError) {
    return errorResponse(res, 404, err.message, 'NOT_FOUND');
  }
  if (err instanceof ValidationError) {
    return errorResponse(res, 400, err.message, 'VALIDATION_ERROR', err.fields);
  }
  if (err instanceof UnauthorizedError) {
    return errorResponse(res, 401, err.message, 'UNAUTHORIZED');
  }
  if (err instanceof ForbiddenError) {
    return errorResponse(res, 403, err.message, 'FORBIDDEN');
  }
  // Unexpected errors — don't leak details in production
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return errorResponse(
    res,
    500,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    'INTERNAL_ERROR'
  );
}
```

---

## Step 3 — Update Error Classes

**File:** `server/utils/errorUtils.ts`

```typescript
// Ensure these classes are defined (add if missing):

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  fields?: Record<string, string[]>;
  constructor(message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
```

---

## Step 4 — Migrate Route Responses to Standard Shape

After splitting routes into domain modules (Milestone 08), update each domain router.

### Orders router example

```typescript
// server/routes/orders.ts

// BEFORE (inconsistent):
res.json(order);                              // Shape B
res.json({ order, warning: null });           // Shape C
res.status(200).json({ success: true, data: orders });  // Shape A

// AFTER (all consistent):
import { ok, paginated, created } from '../utils/apiResponse';

// Get list:
res.json(paginated(orders, total, page, limit));

// Get single:
res.json(ok(order));

// Create:
res.status(201).json(created(order));

// Update:
res.json(ok(updatedOrder));

// Delete:
res.json(ok({ id }));

// Not found:
throw new NotFoundError(`Order ${id} not found`);
```

### All domain routers to update:
- `server/routes/orders.ts`
- `server/routes/products.ts`
- `server/routes/customers.ts`
- `server/routes/suppliers.ts`
- `server/routes/inventory.ts`
- `server/routes/production.ts`
- `server/routes/reports.ts`
- `server/routes/settings.ts`
- `server/routes/callLogs.ts`
- `server/routes/barcode.ts`
- `server/routes/labels.ts`
- `server/routes/auth.ts`

---

## Step 5 — Remove Duplicate Route Registrations

**File:** `server/routes.ts` → `server/routes/index.ts`

```bash
# Find duplicates:
grep -n "app\.\(get\|post\|patch\|put\|delete\).*'/api/users'" server/routes.ts
grep -n "app\.\(get\|post\|patch\|put\|delete\).*'order-errors\|order-quality'" server/routes.ts
```

**Action for each duplicate:**
1. Identify which registration is the authoritative one (usually the one with Zod validation)
2. Delete the other one entirely
3. Verify no frontend code calls any path that was removed

---

## Step 6 — Update Frontend Query Hooks

After the API shape is consistent, remove all the defensive `select` callbacks:

```typescript
// BEFORE — in various frontend hooks:
const { data: orders } = useQuery({
  queryKey: ['/api/orders'],
  select: (data: any) => {
    if (data && typeof data === 'object' && 'data' in data) return data.data;
    return Array.isArray(data) ? data : [];
  }
});

// AFTER — shape is always { success: true, data: [...] }:
const { data: response } = useQuery<PaginatedResponse<Order>>({
  queryKey: ['/api/orders'],
});
const orders = response?.data ?? [];
const pagination = response?.pagination;
```

Import types from `shared/apiTypes.ts`:
```typescript
import type { ApiResponse, PaginatedResponse } from '@shared/apiTypes';
```

---

## Verification

```bash
# 1. Start app
npm run dev

# 2. Check every endpoint returns consistent shape:
curl -s http://localhost:5000/api/orders | jq 'keys'
# Expected: ["data", "pagination", "success"]

curl -s http://localhost:5000/api/products/1 | jq 'keys'
# Expected: ["data", "success"]

# 3. Check error responses are consistent:
curl -s http://localhost:5000/api/orders/99999 | jq
# Expected: {"success": false, "message": "Order 99999 not found", "code": "NOT_FOUND"}

curl -s -X POST http://localhost:5000/api/orders -d '{}' | jq
# Expected: {"success": false, "message": "...", "code": "VALIDATION_ERROR", "errors": {...}}

# 4. Run TypeScript type check — no any errors on API responses:
npm run typecheck
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── utils/
│   │   ├── apiResponse.ts     ← NEW: ok(), paginated(), created() helpers
│   │   └── errorUtils.ts      ← MODIFIED: Complete error class set
│   ├── middlewares/
│   │   └── errorHandler.ts    ← MODIFIED: Consistent ErrorResponse shape
│   └── routes/
│       └── *.ts               ← MODIFIED: All domain routers use standard shape
├── shared/
│   └── apiTypes.ts            ← NEW: Shared response type definitions
└── client/
    └── src/
        └── hooks/ or queries/  ← MODIFIED: Remove defensive select callbacks
```

---

## Next Milestone

→ [MILESTONE_15_QUERY_OPTIMIZATION.md](./MILESTONE_15_QUERY_OPTIMIZATION.md) — Fix N+1 queries and push pagination into the database
