# Amphoreus V2 — AI Session Memory

> Load this file at the start of every new chat session.
> It gives the AI complete context to continue work without re-explaining the project.

---

## What This Project Is

**Amphoreus** is a custom warehouse management system (WMS) for a small business. It tracks inventory, orders, customers, suppliers, production, and shipping labels. The current V1 runs on Replit (Node.js + Neon PostgreSQL). V2 is a migration to a self-hosted Mac Mini M4 with Docker.

**Repository name:** `amphoreus-v2` (new GitHub repo, fresh start)
**Local path (V1 reference):** `/home/user/InventoryOrderManager`
**V2 doc path:** `/home/user/InventoryOrderManager/docs/v2/`

---

## Tech Stack

### Backend
- **Node.js** (kept from V1 — no framework migration)
- **Express.js** — HTTP server
- **Drizzle ORM** — database queries (`shared/schema.ts`, `server/storage.postgresql.ts`)
- **PostgreSQL 16** — primary database (Docker container)
- **Redis 7** — caching (`ioredis` package, wired in Milestone 04)
- **zod** — validation schemas
- **passport.js** — session auth (`express-session` + `connect-pg-simple`)

### Frontend
- **React 18** + **TypeScript**
- **Vite** — build tool
- **wouter** — client-side routing (NOT React Router, NOT Next.js)
- **shadcn/ui** + **Tailwind CSS** — UI components
- **TanStack Query** — server state management

### Infrastructure
- **Docker Compose** — multi-service stack (app + postgres + redis + cloudflared)
- **Cloudflare Tunnel** — zero open ports, encrypted ingress (replaces port forwarding)
- **Cloudflare Firewall Rules** — edge geoblocking (replaces app-level `geoip-lite`)
- **GitHub Actions** — push-to-deploy CI/CD via SSH
- **Backblaze B2** — cloud backup target via `rclone`

---

## V2 Goal Summary

Migrate from Replit to Mac Mini M4 with:
1. Docker Compose replacing Replit runtime
2. PostgreSQL 16 Docker container replacing Neon
3. Redis cache actually wired (was installed but unused in V1)
4. Remove all `@replit/*` npm packages and plugins
5. Cloudflare Tunnel for HTTPS without router port-forwarding
6. DB schema hardened (FK constraints, CHECK constraints, triggers)
7. Critical bug fixes (stock picking race condition, SKU update, image paths)
8. **Auth hardened** — most V1 routes are unauthenticated (public API)
9. **Structured logging** — 165+ console.log replaced with Winston
10. Routes split into domain modules
11. **Consistent API response shape** across all 186 endpoints
12. **Query optimization** — N+1 eliminated, pagination pushed to SQL
13. **Shared TypeScript types** — single source of truth from Drizzle schema
14. **Integration test suite** — order lifecycle, stock picking, payment triggers
15. CI/CD pipeline (GitHub Actions → SSH → docker compose build + restart + tests)
16. Automated nightly backup (pg_dump → rclone → Backblaze B2, 7-day retention)
17. One-time data migration (Neon pg_dump → Mac Mini postgres restore)

---

## Milestone Map

### Execution Order (follow this sequence exactly)

| Step | File | Priority | What It Does |
|------|------|----------|--------------|
| 1 | MILESTONE_01_REPO_AND_DOCKER.md | P1 | New repo + Dockerfile + docker-compose.yml |
| 2 | MILESTONE_02_CLEAN_BUILD.md | P1 | Remove @replit/* packages + vite.config fix |
| 3 | MILESTONE_03_ENV_CONFIG.md | P1 | .env.example + startup validation (fail-fast on missing vars) |
| 4 | MILESTONE_04_REDIS_WIRING.md | P1 | Wire ioredis into cacheManager.ts |
| 5 | MILESTONE_05_GEOBLOCKING.md | P1 | Remove geoip-lite, move blocking to Cloudflare |
| 6 | MILESTONE_06_DATABASE_SCHEMA.md | P1 | SQL migration: reserved_stock + FK + CHECK + triggers |
| 7 | MILESTONE_07_BUG_FIXES.md | P1 | Stock picking race condition + SKU bug + image paths |
| 8 | **MILESTONE_13_AUTH_HARDENING.md** | **P1** | **Add auth to all unprotected routes, delete debug endpoints, fix cookie.secure** |
| 9 | **MILESTONE_16_STRUCTURED_LOGGING.md** | **P2** | **Replace 165+ console.log with Winston, sanitize passwords from logs** |
| 10 | MILESTONE_08_ROUTES_SPLIT.md | P2 | Split 5,374-line routes.ts into 12 domain modules |
| 11 | **MILESTONE_14_API_STANDARDIZATION.md** | **P2** | **Consistent { success, data, pagination } shape across all endpoints** |
| 12 | **MILESTONE_15_QUERY_OPTIMIZATION.md** | **P2** | **Eliminate N+1 queries, push pagination/search into SQL** |
| 13 | **MILESTONE_17_SHARED_TYPE_CLEANUP.md** | **P3** | **Single-source types from schema, fix role mismatch, delete .bak files** |
| 14 | **MILESTONE_18_TESTING_FOUNDATION.md** | **P2** | **Vitest + integration tests for order lifecycle, stock picking, payments** |
| 15 | MILESTONE_09_CI_CD.md | P2 | GitHub Actions push-to-deploy (now runs tests before deploying) |
| 16 | MILESTONE_10_BACKUP.md | P2 | Nightly pg_dump → Backblaze B2, 7-day retention |
| 17 | MILESTONE_11_DATA_MIGRATION.md | P1 | One-time Neon → Mac Mini data transfer |
| 18 | MILESTONE_12_FRONTEND_CLEANUP.md | P3 | Error boundaries, remove remaining debug code |
| 19 | **MILESTONE_19_SIDEBAR_FIX.md** | **P1** | **Fix window.location.href + DOM mutations in Sidebar; add flyout for collapsed mode** |
| 20 | **MILESTONE_20_WAREHOUSE_PICKING_UX.md** | **P1** | **Mobile-first picking UI: card layout, progress bar, audio feedback, sticky CTA** |
| 21 | **MILESTONE_21_DASHBOARD_V2.md** | **P2** | **Fix mock production stats, wire pagination, financial summary row, reorder alerts widget** |
| 22 | **MILESTONE_22_ORDER_FORM_STREAMLINE.md** | **P2** | **Move New Order to /orders/new route; replace 12-field inline customer form with Quick Create popover** |
| 23 | **MILESTONE_23_TABLE_IMPROVEMENTS.md** | **P2** | **Server-side pagination + sort for Customers/Products; Reports time range fix; reusable EmptyState** |
| 24 | **MILESTONE_24_SETTINGS_REORGANIZATION.md** | **P3** | **Group 9 flat Settings tabs into 4 sections; remove theming controls from Login page** |
| 25 | **MILESTONE_25_NOTIFICATION_PERSISTENCE.md** | **P3** | **Persist notifications to localStorage + DB; financial alert polling; remove console.log** |

**Bold rows = new milestones added from codebase review (steps 8–14 and 19–25)**

### Why This Order

- **Auth hardening (8) before routes split (10):** Harden routes while they're still in one file — easier to audit. Reorganize only after they're secure.
- **Logging (9) before CI/CD (15):** Production needs structured logs before the system goes live.
- **API standardization (11) before tests (14):** Tests should test the stable, final API shape — not an inconsistent in-progress one.
- **Tests (14) before CI/CD (15):** The CI pipeline runs tests. Tests must exist first.
- **Data migration (17) near end:** Don't migrate real data onto a system that still has open security issues.

---

## Critical V1 Bugs Being Fixed in V2

### Bug 1: Stock Picking Race Condition (Milestone 07)
**Problem:** Multiple warehouse workers picking the same order simultaneously can both read `current_stock = 10`, both deduct 10, leaving stock at -10 (negative).

**Fix:** `server/services/orderPickingService.ts` using `db.transaction()` + `SELECT FOR UPDATE` row locking. Stock model changes to:
- `current_stock` = physical inventory (only decremented when physically picked)
- `reserved_stock` = committed to pending orders (incremented at order creation, decremented at picking)
- `available_stock` = `current_stock - reserved_stock` (computed, not stored)

### Bug 2: SKU Update Clears to NULL (Milestone 07)
**Problem:** The Zod schema for product updates uses `z.preprocess` incorrectly. When SKU field is sent as-is (no change), it transforms to `undefined`, which Drizzle treats as NULL, wiping the SKU.

**Broken code in `server/api/products.ts`:**
```typescript
sku: z.preprocess(
  (val) => val === null || val === undefined || val === '' ? undefined : val,
  z.string().transform(val => val ? val.toUpperCase() : undefined).optional()
),
```

**Fix:** Simple `z.string().optional()` with `.toUpperCase()` applied only in the route handler if the value is present.

### Bug 3: Product Images Break After Upload (Milestone 07)
**Problem:** `server/api/imageUploadFix.ts` writes files to a path but returns a URL pointing to a symlink path. On Docker, symlinks don't work cross-container. Also: the URL is saved before confirming the file exists.

**Fix:** `server/services/storageService.ts` — write file first, confirm it exists, then return the URL for DB storage. Serve files from `/api/files/products/:filename`.

---

## Additional V1 Security & Quality Issues (from codebase review)

These are addressed in milestones 13–18:

| Issue | Severity | Milestone |
|---|---|---|
| ~60 routes have no `isAuthenticated` guard — API is effectively public | CRITICAL | 13 |
| `/api/debug/*` endpoints fire real Slack notifications unauthenticated | HIGH | 13 |
| `cookie.secure: false` hardcoded in auth.ts:37 | HIGH | 13 |
| Default `admin / admin123` created automatically in production | HIGH | 13 |
| `userId: 1` fallback in 9 places corrupts audit trail silently | MEDIUM | 13 |
| 165+ `console.log` in routes.ts — no structured logging | MEDIUM | 16 |
| `req.body` (incl. passwords) logged in error handler | MEDIUM | 16 |
| N+1 query on `GET /api/orders` — 100 orders = 101 queries | CRITICAL | 15 |
| Full table loaded to memory, filtered in JS (search, customer history) | HIGH | 15 |
| Application-level pagination — database never sees LIMIT/OFFSET | HIGH | 15 |
| `createOrder` is non-atomic (TEMP order left on crash) | MEDIUM | 15 |
| Three different API response shapes — frontend uses `as any` to handle | HIGH | 14 |
| `POST /api/users` registered twice — second has no Zod validation | HIGH | 14 |
| `req.user as any` used 10+ times — no type safety on session user | HIGH | 17 |
| `'manager'` role in frontend type, not in backend schema | MEDIUM | 17 |
| Order types redefined in 5+ components, diverge from DB schema | MEDIUM | 17 |
| 5 `.bak` files committed to repo | LOW | 17 |
| Zero test coverage — no test framework installed | CRITICAL | 18 |

---

## Key Files in V1 Codebase

| File | Lines | What It Is |
|------|-------|-----------|
| `shared/schema.ts` | 1,677 | All Drizzle ORM table definitions — 40+ tables, ZERO FK constraints |
| `server/routes.ts` | 5,374 | Monolithic router — ALL 186 endpoints in one file |
| `server/storage.postgresql.ts` | 5,014 | Storage abstraction layer — all DB queries |
| `server/db.ts` | ~30 | DB connection — has Neon WebSocket block to remove |
| `server/api/products.ts` | ~200 | Product API — has broken SKU Zod schema |
| `server/api/imageUploadFix.ts` | ~80 | Image upload — broken symlink approach |
| `Dockerfile` | 19 | Single-stage, no multi-stage optimization |
| `vite.config.ts` | ~40 | Has 3 @replit/* plugins to remove |

---

## V1 Replit Artifacts to Remove (Milestone 02)

### NPM packages to uninstall:
```bash
npm uninstall @replit/vite-plugin-cartographer
npm uninstall @replit/vite-plugin-runtime-error-modal
npm uninstall @replit/vite-plugin-shadcn-theme-json
```

### `vite.config.ts` plugins to remove:
```typescript
// DELETE all of these:
import cartographer from "@replit/vite-plugin-cartographer";
import runtimeErrorModal from "@replit/vite-plugin-runtime-error-modal";
import shadcnThemeJson from "@replit/vite-plugin-shadcn-theme-json";
```

### `server/db.ts` Neon WebSocket block to remove:
```typescript
// DELETE this entire block:
if (process.env.DATABASE_URL?.includes('neon.tech')) {
  neonConfig.webSocketConstructor = ws;
}
```

---

## Docker Compose Services (from Milestone 01)

```
app          → Node.js Express (port 5000 internal only)
postgres     → PostgreSQL 16 (port 5432 internal only)
redis        → Redis 7 (port 6379 internal only)
cloudflared  → Cloudflare Tunnel (no exposed ports — tunnels HTTPS to app:5000)
backup       → Alpine cron job for nightly pg_dump (Milestone 10)
```

All services on `internal` network. **Only cloudflared touches the internet.**

---

## Environment Variables (Key Ones)

```bash
# Required for app to start:
DATABASE_URL=postgresql://amphoreus:PASSWORD@postgres:5432/amphoreus
SESSION_SECRET=<32+ char random string>
NODE_ENV=production

# Required for Cloudflare Tunnel:
CLOUDFLARE_TUNNEL_TOKEN=<from cloudflare zero trust dashboard>

# Optional but recommended:
REDIS_URL=redis://redis:6379
SMTP_HOST=smtp.example.com
SMTP_USER=notifications@example.com
SMTP_PASS=<password>

# Required for backups (Milestone 10):
B2_ACCOUNT_ID=<backblaze account id>
B2_APPLICATION_KEY=<backblaze app key>
B2_BUCKET_NAME=amphoreus-backups
```

---

## Database Schema Key Facts

- **ORM:** Drizzle ORM with `drizzle-zod` for validation schemas
- **DB:** PostgreSQL 16 (was Neon serverless, now Docker)
- **Schema file:** `shared/schema.ts` — used by both server AND client (type sharing)
- **V1 issues:** Zero FK constraints, no `reserved_stock` field on products
- **V2 adds:** FK constraints, CHECK constraints, indexes, payment triggers, `reserved_stock`
- **Migration file:** `migrations/init/001_v2_schema.sql` — runs automatically on first Docker start

### Products table (V2 stock model):
```
current_stock  = physical count in warehouse
reserved_stock = committed to pending orders (not yet picked)
available      = current_stock - reserved_stock  (computed)
```

---

## Cloudflare Setup Notes

- **Tunnel:** Created in Cloudflare Zero Trust dashboard → Access → Tunnels
- **TUNNEL_TOKEN** is generated there and pasted into `.env.production`
- **Firewall Rule** (geoblocking): Security → WAF → Custom Rules
  - Expression: `not (ip.geoip.country in {"GR" "CY"})` (adjust country codes)
  - Action: Block
- **No router port-forwarding needed** — the tunnel creates an outbound connection

---

## CI/CD Flow (Milestone 09)

```
git push origin main
    ↓
GitHub Actions: TypeScript type check
    ↓ (if passes)
GitHub Actions: SSH into Mac Mini
    ↓
Mac Mini: git pull origin main
    ↓
Mac Mini: docker compose build app
    ↓
Mac Mini: docker compose up -d --no-deps --build app
    ↓
Mac Mini: Poll /api/health for 60s
    ↓ (if fails)
Mac Mini: docker compose restart app (rollback)
    ↓
GitHub Actions: Notify Slack (success or failure)
```

---

## Backup Flow (Milestone 10)

```
Daily at 2:00 AM (cron in backup container):
    ↓
pg_dump → gzip → /tmp/backups/amphoreus_db_YYYYMMDD_HHMMSS.sql.gz
    ↓
tar -czf → /tmp/backups/amphoreus_storage_YYYYMMDD_HHMMSS.tar.gz
    ↓
rclone copy → b2:amphoreus-backups/database/
rclone copy → b2:amphoreus-backups/storage/
    ↓
Delete local temp files
    ↓
Delete B2 files older than 7 days
```

---

## What Has NOT Been Changed Yet

Everything in the milestone docs is **documentation only** — no code has been modified in the V1 codebase. The milestone files describe what needs to be built in the new `amphoreus-v2` repo.

**V1 codebase (`/home/user/InventoryOrderManager`) is untouched and reference-only.**

---

## How to Use These Milestone Files

Each milestone file is self-contained. You can paste it directly into Cursor/Windsurf and say:
> "Implement this milestone exactly as described."

The files contain:
- Complete code to write/copy
- Step-by-step instructions
- Verification commands to run after each step

**Do not skip milestones.** Each one depends on previous ones as noted in the "Depends on" header.

---

## Important Rules for AI Sessions

1. **Do not modify V1 code** in `/home/user/InventoryOrderManager` — it's reference-only
2. **All V2 work goes into the new `amphoreus-v2` repo** (to be created on GitHub)
3. **Review before implementing** — read the milestone file before writing any code
4. **One milestone at a time** — complete and verify before starting the next
5. **Commits go to `claude/plan-v2-architecture-zCS4D`** during planning phase
6. **Production branch is `main`** — only push there after milestones are verified

---

## Questions to Answer Before Starting

Before implementing Milestone 01, confirm with the user:

1. **Mac Mini local IP** (for SSH config, e.g., `192.168.1.100`)
2. **Mac Mini username** (for Docker/SSH, e.g., `yourname`)
3. **Domain name** to use with Cloudflare (e.g., `amphoreus.example.com`)
4. **GitHub org/username** for the new `amphoreus-v2` repo
5. **Country codes** for geoblocking (Cloudflare firewall rule)
6. **Slack webhook URL** for CI/CD notifications (optional — can skip)

These are needed to fill in the `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` GitHub secrets in Milestone 09.

---

## File Index

```
docs/v2/
├── memory.md                           ← THIS FILE — load at session start
├── MASTER_PLAN.md                      ← Full architecture overview + decisions log
│
│  ── INFRASTRUCTURE ──────────────────────────────────────────────────────────
├── MILESTONE_01_REPO_AND_DOCKER.md     ← Step 1:  New repo + Docker stack
├── MILESTONE_02_CLEAN_BUILD.md         ← Step 2:  Remove Replit artifacts
├── MILESTONE_03_ENV_CONFIG.md          ← Step 3:  Env vars + startup validation
├── MILESTONE_04_REDIS_WIRING.md        ← Step 4:  Wire Redis into cacheManager
├── MILESTONE_05_GEOBLOCKING.md         ← Step 5:  Remove geoip-lite
│
│  ── DATABASE & CORE FIXES ──────────────────────────────────────────────────
├── MILESTONE_06_DATABASE_SCHEMA.md     ← Step 6:  SQL migration: FK + CHECK + triggers
├── MILESTONE_07_BUG_FIXES.md           ← Step 7:  Stock picking + SKU + images
│
│  ── SECURITY & QUALITY ─────────────────────────────────────────────────────
├── MILESTONE_13_AUTH_HARDENING.md      ← Step 8:  Auth on all routes, delete debug endpoints
├── MILESTONE_16_STRUCTURED_LOGGING.md  ← Step 9:  Replace console.log with Winston
│
│  ── CODE ORGANIZATION ──────────────────────────────────────────────────────
├── MILESTONE_08_ROUTES_SPLIT.md        ← Step 10: Split 5374-line routes.ts
├── MILESTONE_14_API_STANDARDIZATION.md ← Step 11: Consistent response shape
├── MILESTONE_15_QUERY_OPTIMIZATION.md  ← Step 12: Eliminate N+1, SQL pagination
├── MILESTONE_17_SHARED_TYPE_CLEANUP.md ← Step 13: Single-source types, fix role mismatch
│
│  ── TESTING & CI/CD ────────────────────────────────────────────────────────
├── MILESTONE_18_TESTING_FOUNDATION.md  ← Step 14: Vitest + integration tests
├── MILESTONE_09_CI_CD.md               ← Step 15: GitHub Actions (runs tests first)
├── MILESTONE_10_BACKUP.md              ← Step 16: Nightly pg_dump → Backblaze B2
│
│  ── GO-LIVE ────────────────────────────────────────────────────────────────
├── MILESTONE_11_DATA_MIGRATION.md      ← Step 17: One-time Replit → Mac Mini migration
└── MILESTONE_12_FRONTEND_CLEANUP.md    ← Step 18: Final polish + error boundaries
│
│  ── UX IMPROVEMENTS ───────────────────────────────────────────────────────
├── MILESTONE_19_SIDEBAR_FIX.md         ← Step 19: Fix Sidebar nav (window.location.href, DOM mutations, flyout)
├── MILESTONE_20_WAREHOUSE_PICKING_UX.md← Step 20: Mobile-first pick list (cards, progress, audio, sticky CTA)
├── MILESTONE_21_DASHBOARD_V2.md        ← Step 21: Dashboard: live stats, pagination, financial row, reorder widget
├── MILESTONE_22_ORDER_FORM_STREAMLINE.md← Step 22: New Order as full page; Quick Create Customer popover
├── MILESTONE_23_TABLE_IMPROVEMENTS.md  ← Step 23: Server-side pagination/sort; EmptyState; remove debug routes
├── MILESTONE_24_SETTINGS_REORGANIZATION.md← Step 24: 4-section Settings; remove Login theming controls
└── MILESTONE_25_NOTIFICATION_PERSISTENCE.md← Step 25: Persist notifications; financial alerts; remove console.log
```
