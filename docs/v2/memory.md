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
8. CI/CD pipeline (GitHub Actions → SSH → docker compose build + restart)
9. Automated nightly backup (pg_dump → rclone → Backblaze B2, 7-day retention)
10. One-time data migration (Neon pg_dump → Mac Mini postgres restore)

---

## Milestone Map

| # | File | Status | Priority | What It Does |
|---|------|--------|----------|--------------|
| 01 | MILESTONE_01_REPO_AND_DOCKER.md | Ready to implement | P1 | New repo + Dockerfile + docker-compose.yml |
| 02 | MILESTONE_02_CLEAN_BUILD.md | Ready to implement | P1 | Remove @replit/* packages + vite.config fix |
| 03 | MILESTONE_03_ENV_CONFIG.md | Ready to implement | P1 | .env.example + startup validation |
| 04 | MILESTONE_04_REDIS_WIRING.md | Ready to implement | P1 | Wire ioredis into cacheManager.ts |
| 05 | MILESTONE_05_GEOBLOCKING.md | Ready to implement | P1 | Remove geoip-lite, move to Cloudflare |
| 06 | MILESTONE_06_DATABASE_SCHEMA.md | Ready to implement | P1 | SQL migration: reserved_stock + FK + triggers |
| 07 | MILESTONE_07_BUG_FIXES.md | Ready to implement | P1 | Order picking fix + SKU fix + image fix |
| 08 | MILESTONE_08_ROUTES_SPLIT.md | Ready to implement | P2 | Split 5,374-line routes.ts into domain modules |
| 09 | MILESTONE_09_CI_CD.md | Ready to implement | P2 | GitHub Actions push-to-deploy |
| 10 | MILESTONE_10_BACKUP.md | Ready to implement | P2 | Nightly pg_dump → Backblaze B2 |
| 11 | MILESTONE_11_DATA_MIGRATION.md | Ready to implement | P1 | One-time Neon → Mac Mini data transfer |
| 12 | MILESTONE_12_FRONTEND_CLEANUP.md | Ready to implement | P3 | Remove debug endpoints, error boundaries |

**Recommended build order:** 01 → 02 → 03 → 04 → 05 → 06 → 07 → 11 → 08 → 09 → 10 → 12

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
├── memory.md                          ← THIS FILE — load at session start
├── MASTER_PLAN.md                     ← Full architecture overview + decisions log
├── MILESTONE_01_REPO_AND_DOCKER.md    ← New repo + Docker stack
├── MILESTONE_02_CLEAN_BUILD.md        ← Remove Replit artifacts
├── MILESTONE_03_ENV_CONFIG.md         ← Env vars + startup validation
├── MILESTONE_04_REDIS_WIRING.md       ← Wire Redis into cacheManager
├── MILESTONE_05_GEOBLOCKING.md        ← Remove geoip-lite
├── MILESTONE_06_DATABASE_SCHEMA.md    ← SQL migrations + schema hardening
├── MILESTONE_07_BUG_FIXES.md          ← Stock picking + SKU + images
├── MILESTONE_08_ROUTES_SPLIT.md       ← Split monolithic routes.ts
├── MILESTONE_09_CI_CD.md              ← GitHub Actions deploy workflow
├── MILESTONE_10_BACKUP.md             ← Nightly pg_dump to Backblaze B2
├── MILESTONE_11_DATA_MIGRATION.md     ← One-time Replit → Mac Mini migration
└── MILESTONE_12_FRONTEND_CLEANUP.md   ← Debug cleanup + error boundaries
```
