# Milestone 13 — Authentication & Security Hardening

**Priority:** P1
**Depends on:** Milestone 07 (Bug fixes)
**Blocks:** Milestone 08 (Routes split — harden before reorganizing)
**Execution order:** Run BEFORE Milestone 08

---

## Objective

The V1 API is effectively public — the majority of routes that read or mutate real business data have no authentication guard. This milestone closes every unauthenticated data endpoint, removes debug routes left in production, and fixes session cookie security. This must be done before going live and before the routes are split in Milestone 08.

---

## Problem Summary (from codebase review)

| Issue | Location | Risk |
|---|---|---|
| `GET /api/orders` — no auth | routes.ts | All orders exposed publicly |
| `GET /api/customers` + CRUD — no auth | routes.ts | All customer PII exposed |
| `GET /api/products` + create — no auth | routes.ts | Product catalog + create publicly accessible |
| `GET /api/dashboard/stats` — no auth | routes.ts | Business metrics exposed |
| All 8 `/api/analytics/*` — no auth | routes.ts | Full analytics exposed |
| `POST /api/orders/complete-shipment` — no auth | routes.ts | Anyone can complete a shipment |
| `GET /api/direct-label/:orderId` — no auth | routes.ts | Anyone can print any shipping label |
| `GET /api/debug/notification-settings` — no auth | routes.ts | Leaks config, marked "REMOVE IN PROD" |
| `GET /api/debug/test-slack-order` — no auth | routes.ts | Fires real Slack notifications |
| `GET /toggle-geoblocking` — no auth, GET mutates state | routes.ts | Anyone can toggle security |
| `cookie.secure: false` hardcoded | auth.ts:37 | Sessions over HTTP in production |
| Default `admin / admin123` auto-created | auth.ts:226 | Known credential in prod |
| `userId: 1` fallback in 9 places | routes.ts | Audit trail corrupted silently |

---

## Step 1 — Fix Session Cookie Security

**File:** `server/auth.ts`

```typescript
// BEFORE (line ~37):
secure: false, // Allow cookies over HTTP for now (even in production)

// AFTER:
secure: process.env.NODE_ENV === 'production',
```

Also add `sameSite`:
```typescript
cookie: {
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
},
```

---

## Step 2 — Require SESSION_SECRET at Startup (Fail Fast)

**File:** `server/auth.ts`

```typescript
// REMOVE this block entirely (~lines 45–47):
// if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
//   process.env.SESSION_SECRET = require('crypto').randomBytes(64).toString('hex');
// }

// REPLACE with fail-fast (coordinate with server/config.ts from Milestone 03):
// SESSION_SECRET is validated in config.ts at startup.
// If missing the app refuses to start — no silent fallback.
```

The `config.ts` from Milestone 03 already validates `SESSION_SECRET`. Remove the random-generation fallback from `auth.ts` so the validation in `config.ts` is the single enforcement point.

---

## Step 3 — Remove Default Admin Auto-Creation

**File:** `server/auth.ts`

The auto-creation of `admin / admin123` should be replaced with a startup check that requires an admin to be explicitly created via a one-time setup command or environment variable seeding.

```typescript
// REMOVE the auto-create block (~lines 222–240):
// const hashedPassword = await bcrypt.hash('admin123', 10);
// log('Default admin user created. Username: admin, Password: admin123', 'auth');

// REPLACE with:
// In production, if no admin exists, log a warning and require manual setup.
// In development, keep the seeding but log clearly it's dev-only.

const adminCount = await db.select({ count: count() })
  .from(users)
  .where(eq(users.role, 'admin'));

if (adminCount[0].count === 0) {
  if (process.env.NODE_ENV === 'production') {
    // Don't auto-create in production — require explicit seeding
    console.warn(
      '[AUTH] WARNING: No admin user exists. ' +
      'Create one manually: npm run seed:admin'
    );
  } else {
    // Dev only: create a default admin for local development
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.insert(users).values({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      fullName: 'Admin User',
    });
    console.log('[DEV] Default admin created: admin / admin123');
  }
}
```

Add a seed script for production admin creation:

```typescript
// scripts/seed-admin.ts
// Usage: npm run seed:admin
// Environment vars: ADMIN_USERNAME, ADMIN_PASSWORD (required)
import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcryptjs';

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error('ADMIN_USERNAME and ADMIN_PASSWORD env vars required');
  process.exit(1);
}

const hashed = await bcrypt.hash(password, 12);
await db.insert(users).values({
  username,
  password: hashed,
  role: 'admin',
  fullName: 'System Admin',
});
console.log(`Admin user '${username}' created.`);
process.exit(0);
```

Add to `package.json`:
```json
"scripts": {
  "seed:admin": "tsx scripts/seed-admin.ts"
}
```

---

## Step 4 — Delete Debug Endpoints

**File:** `server/routes.ts`

Find and **delete** these route registrations entirely:

```bash
# Find them:
grep -n "debug\|test-slack\|test-deployment\|test-order-pdf" server/routes.ts
```

Routes to delete:
```typescript
// DELETE — explicitly marked "REMOVE IN PRODUCTION" but never removed:
app.get('/api/debug/notification-settings', ...);
app.get('/api/debug/test-slack-order', ...);
app.get('/test-deployment', ...);
app.get('/test-order-pdf/:id', ...);
```

Any debug capability needed in production should be behind `isAuthenticated` + `hasRole('admin')` and should use POST not GET.

---

## Step 5 — Fix State-Mutating GET Endpoints

**File:** `server/routes.ts`

```typescript
// BEFORE (GET that mutates state, no auth):
app.get('/toggle-geoblocking', toggleGeoblocking);
app.get('/remove-from-allowlist', removeFromAllowlist);

// AFTER (POST, with auth — note: geoblocking middleware itself is removed in Milestone 05):
// If keeping geoblocking admin routes at all:
app.post('/api/admin/geoblocking/toggle', isAuthenticated, hasRole('admin'), toggleGeoblocking);
app.post('/api/admin/geoblocking/allowlist/remove', isAuthenticated, hasRole('admin'), removeFromAllowlist);
```

---

## Step 6 — Add `isAuthenticated` to All Unprotected Data Routes

This is the bulk of the work. For each route group listed below, add `isAuthenticated` as middleware.

### Pattern
```typescript
// BEFORE:
app.get('/api/orders', async (req, res) => {

// AFTER:
app.get('/api/orders', isAuthenticated, async (req, res) => {
```

### Routes Requiring Auth (add `isAuthenticated` to each)

**Orders:**
```
GET    /api/orders
GET    /api/orders/recent
GET    /api/orders/search
GET    /api/orders/:id
POST   /api/orders
PATCH  /api/orders/:id
PATCH  /api/orders/:id/status
DELETE /api/orders/:id
POST   /api/orders/complete-shipment
GET    /api/orders/:id/generate-label
GET    /api/direct-label/:orderId/:...
```

**Customers:**
```
GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PATCH  /api/customers/:id
DELETE /api/customers/:id
GET    /api/customers/:id/orders
```

**Products:**
```
GET    /api/products
GET    /api/products/:id
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
GET    /api/products/search
GET    /api/products/slow-moving
```

**Dashboard & Analytics:**
```
GET    /api/dashboard/stats
GET    /api/analytics/revenue
GET    /api/analytics/products
GET    /api/analytics/customers
GET    /api/analytics/inventory-trend
GET    /api/analytics/order-status
GET    /api/analytics/top-products
GET    /api/analytics/monthly-summary
GET    /api/analytics/sales-by-category
```

**Inventory, Suppliers, Production, Reports, Settings, Call Logs, Barcodes:**
```
ALL routes under these domains
```

### Script to audit coverage after applying
```bash
# After applying auth guards, verify no data routes are still public:
# Search for routes that have async handlers but no isAuthenticated:
grep -n "app\.\(get\|post\|patch\|put\|delete\).*async" server/routes.ts | head -50
# Manually verify each has isAuthenticated between the path and the handler
```

---

## Step 7 — Fix Print/Label Route Authentication

**File:** `client/src/App.tsx`

```typescript
// BEFORE — print routes bypass auth entirely:
const unauthenticatedRoutes = ['/login', '/print-template', '/shipping-label/:id', '/print-labels/:orderId/:boxCount'];

// AFTER — only login bypasses auth:
const unauthenticatedRoutes = ['/login'];
```

The print pages should check authentication and redirect to login if not authenticated. Since these are typically opened in a new tab (for printing), the user will already be logged in.

---

## Step 8 — Fix `userId: 1` Fallback (Audit Trail Integrity)

**File:** `server/routes.ts` (9 locations)

```bash
# Find all occurrences:
grep -n "|| 1" server/routes.ts
grep -n "?? 1" server/routes.ts
```

```typescript
// BEFORE (silently attributes to admin on session failure):
const userId = (req.user as any)?.id || 1;

// AFTER (throw if no authenticated user — routes are auth-gated so this should never happen):
const userId = (req.user as any)?.id;
if (!userId) {
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}
```

---

## Verification

```bash
# 1. Start the app
npm run dev

# 2. Test that public endpoints are now rejected:
curl -s http://localhost:5000/api/orders
# Expected: 401 or redirect to login, NOT order data

curl -s http://localhost:5000/api/customers
# Expected: 401

curl -s http://localhost:5000/api/dashboard/stats
# Expected: 401

# 3. Test that debug routes are gone:
curl -s http://localhost:5000/api/debug/notification-settings
# Expected: 404

curl -s http://localhost:5000/api/debug/test-slack-order
# Expected: 404

# 4. Test authenticated access still works:
# Log in first to get session cookie, then:
curl -s -b cookies.txt http://localhost:5000/api/orders
# Expected: order data

# 5. Test cookie security flag (in browser devtools):
# Application → Cookies → check HttpOnly=true, Secure=true (in prod)
```

---

## Files Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── auth.ts          ← Fix cookie.secure, remove auto-admin, remove secret fallback
│   └── routes.ts        ← Add isAuthenticated to ~60 routes, delete debug endpoints
├── client/
│   └── src/App.tsx      ← Remove print routes from unauthenticated list
└── scripts/
    └── seed-admin.ts    ← NEW: Production admin creation script
```

---

## Next Milestone

→ [MILESTONE_16_STRUCTURED_LOGGING.md](./MILESTONE_16_STRUCTURED_LOGGING.md) — Replace console.log with structured Winston logging
