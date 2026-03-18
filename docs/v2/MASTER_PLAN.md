# Amphoreus V2 — Master Plan

**Document Version:** 1.0
**Created:** 2025-03-18
**Status:** Active
**Branch:** `claude/plan-v2-architecture-zCS4D`

---

## What Is Amphoreus?

A full-stack warehouse management system for a **Greek food/beverage distribution company** running on Replit today. It manages the complete order-to-shipment lifecycle including:
- Order management & picking
- Inventory control & barcode scanning
- Supplier invoices & payments
- Production facility operations (olive oil)
- CRM & call tracking
- Slack notifications & daily reports
- Shipping label printing (PDF / CAB printer)

**Current Stack:** React 18 + Express.js + PostgreSQL (Neon serverless) + Drizzle ORM
**Current Host:** Replit (cloud PaaS)
**Target Host:** Self-hosted Mac Mini M4 via Docker + Cloudflare Tunnel

---

## Why V2?

### Infrastructure Problems (Replit)
- Monthly cost, vendor lock-in
- Neon serverless DB has connection overhead
- Limited local storage for uploads/labels
- No direct printer control (CAB printer needs LAN access)
- Replit-specific Vite plugins block clean Docker builds

### Application Problems
- `routes.ts` is 5,374 lines — **all 186 endpoints in one file**
- `storage.postgresql.ts` is 5,014 lines — massive maintenance burden
- Stock is deducted at **order creation**, not at **picking** — critical bug
- No database-level foreign key constraints — orphaned records possible
- SKU updates silently fail due to broken Zod preprocessing
- Image uploads use dual paths + symlinks that break on Docker
- `withTransaction()` exists but is used in fewer than 8 places
- Redis/ioredis installed but cache falls back to in-memory everywhere
- Three Replit-specific Vite plugins prevent clean Docker builds
- Geoblocking handled in app middleware — better moved to Cloudflare

---

## V2 Goals

### Goal 1: Self-Hosted Infrastructure (Mac Mini M4)
Move the entire stack off Replit onto a Mac Mini M4:
- Docker Compose: app + postgres:16 + redis:7 + cloudflared
- Cloudflare Tunnel: zero open ports, encrypted ingress
- Cloudflare Firewall: geoblocking at edge (replaces app middleware)
- GitHub Actions: push-to-deploy CI/CD pipeline
- Automated nightly backups to Backblaze B2

### Goal 2: Clean Build
- Remove 3 Replit-specific Vite plugins
- Clean Dockerfile (multi-stage build)
- Single consistent `STORAGE_PATH` for uploads
- Proper `.env` structure for all environments

### Goal 3: Redis Wiring
- Wire `ioredis` (already installed) into `cacheManager.ts`
- Fall back to in-memory only when Redis is unavailable
- Cache dashboard stats, product lists, order summaries

### Goal 4: Critical Bug Fixes (from V2 Spec)
1. **Stock reservation model** — add `reserved_stock` to products
2. **Atomic order picking** — wrap in `db.transaction()` with `SELECT FOR UPDATE`
3. **SKU update fix** — remove broken Zod preprocessing
4. **Image upload fix** — single path, write file before DB update

### Goal 5: Schema & Database Hardening
- Add proper foreign key constraints to all tables
- Add `reserved_stock` field to products
- Add CHECK constraints (stock >= 0, reserved <= current)
- Add database triggers for payment validation

### Goal 6: Routes Modularization
- Split `routes.ts` (5,374 lines) into domain modules
- Each module: orders, products, inventory, customers, suppliers, production, etc.

---

## Architecture Diagram

```
Internet
  └── Cloudflare (DNS + SSL + Firewall/Geoblocking)
        └── Cloudflare Tunnel (zero open ports)
              └── Mac Mini M4
                    └── Docker Compose
                          ├── amphoreus-app   (Node.js/Express, port 5000 internal)
                          ├── postgres:16     (PostgreSQL, internal only)
                          ├── redis:7         (Redis, internal only)
                          └── cloudflared     (Tunnel daemon)
```

---

## New Repository Structure

```
amphoreus-v2/
├── client/                     # React frontend (migrated as-is, then improved)
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── server/
│   ├── routes/                 # NEW: split by domain (not monolithic routes.ts)
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── products.ts
│   │   ├── inventory.ts
│   │   ├── customers.ts
│   │   ├── suppliers.ts
│   │   ├── production.ts
│   │   ├── reports.ts
│   │   └── settings.ts
│   ├── services/               # Business logic (keep existing, clean up)
│   ├── middleware/             # Keep: auth, rate limit, error handler
│   ├── utils/                  # Keep: cacheManager (wire Redis), validation
│   ├── db.ts                   # UPDATED: remove Neon config, add standard PG
│   └── index.ts                # UPDATED: cleaner setup
├── shared/
│   └── schema.ts               # UPDATED: reserved_stock, FKs, constraints
├── migrations/                 # NEW: SQL migration files
│   ├── 001_v2_schema.sql       # Full V2 DDL
│   └── 002_v1_to_v2_data.sql   # Data transformation
├── scripts/
│   ├── backup.sh               # Nightly pg_dump + rclone to B2
│   └── restore.sh              # Restore from backup
├── .github/
│   └── workflows/
│       └── deploy.yml          # Push-to-deploy via SSH
├── docker-compose.yml          # Multi-service compose
├── docker-compose.dev.yml      # Dev override
├── Dockerfile                  # Multi-stage build
├── .env.example                # Template (no secrets)
├── .env.production             # Mac Mini production values (gitignored)
└── memory.md                   # AI chat reference document
```

---

## Milestone Overview

| # | Milestone | Description | Priority |
|---|-----------|-------------|----------|
| 01 | Repo & Docker Infrastructure | New repo, Docker Compose, Dockerfile | **P0** |
| 02 | Clean Build | Remove Replit plugins, fix vite.config.ts | **P0** |
| 03 | Environment Config | .env structure, remove Neon/Replit assumptions | **P0** |
| 04 | Redis Wiring | Wire ioredis into cacheManager.ts | **P1** |
| 05 | Disable App Geoblocking | Remove middleware, document Cloudflare rules | **P1** |
| 06 | Database Schema V2 | reserved_stock, FKs, constraints, triggers | **P1** |
| 07 | Critical Bug Fixes | Stock picking, SKU update, image upload | **P1** |
| 08 | Routes Modularization | Split routes.ts into domain modules | **P2** |
| 09 | CI/CD Pipeline | GitHub Actions push-to-deploy | **P2** |
| 10 | Backup Strategy | pg_dump + rclone to Backblaze B2 | **P2** |
| 11 | Data Migration | Replit → Mac Mini pg_dump/restore | **P3** |
| 12 | Frontend Cleanup | Remove debug pages, fix form issues | **P3** |
| 13 | Auth Hardening | Add auth to all unprotected routes, delete debug endpoints | **P1** |
| 14 | API Standardization | Consistent { success, data, pagination } response shape | **P2** |
| 15 | Query Optimization | Eliminate N+1 queries, push pagination/search into SQL | **P2** |
| 16 | Structured Logging | Replace 165+ console.log with Winston | **P2** |
| 17 | Shared Type Cleanup | Single-source types from Drizzle schema, fix role mismatch | **P3** |
| 18 | Testing Foundation | Vitest + integration tests for order lifecycle, payments | **P2** |
| 19 | Sidebar Fix | Fix broken navigation (window.location.href, DOM mutations, collapsed flyout) | **P1** |
| 20 | Warehouse Picking UX | Mobile-first picking: card layout, progress bar, audio feedback | **P1** |
| 21 | Dashboard V2 | Fix mock stats, wire pagination, financial summary, reorder alerts | **P2** |
| 22 | Order Form Streamline | Route-based create, Quick Create customer popover | **P2** |
| 23 | Table Improvements | Server-side pagination/sort, EmptyState component | **P2** |
| 24 | Settings Reorganization | 4-section layout, remove Login theming controls | **P3** |
| 25 | Notification Persistence | localStorage + DB persistence, financial alert polling | **P3** |

---

## V2 Spec vs Current Codebase — Validation

The V2 Technical Specification (WAREHOUSE_V2_SPECIFICATION.md, v1.8) recommends changes that all make sense given the current codebase analysis:

| Spec Recommendation | Current State | Verdict |
|---------------------|---------------|---------|
| Add `reserved_stock` to products | Missing — stock deducted at order creation | ✅ Critical, implement |
| Add FK constraints everywhere | Zero FK constraints in current schema | ✅ Critical, implement |
| Wrap picking in `db.transaction()` | Uses `withTransaction()` but in <8 places | ✅ Critical, implement |
| Fix SKU Zod preprocessing | Empty string → undefined bug confirmed | ✅ Critical, implement |
| Fix image upload (single path) | Dual-path symlink approach confirmed broken | ✅ Critical, implement |
| Wire Redis cache | ioredis installed, falls back to in-memory | ✅ Quick win |
| Remove Replit Vite plugins | 3 plugins confirmed in vite.config.ts | ✅ Required for Docker |
| Split monolithic routes.ts | Confirmed 5,374 lines, 186 endpoints | ✅ Implement in phases |
| Move geoblocking to Cloudflare | App-level middleware confirmed | ✅ Architecture decision |
| Remove Neon serverless config | Uses Neon WebSocket when DB URL includes neon.tech | ✅ Remove for self-hosted |
| Multi-stage Dockerfile | Current Dockerfile: 19 lines, no multi-stage | ✅ Improve |
| Docker Compose multi-service | No docker-compose.yml exists | ✅ Create |

**Conclusion:** All V2 spec recommendations are validated by codebase analysis. No spec items are contradicted by what exists.

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-03-18 | Self-host on Mac Mini M4 | Cost, LAN printer access, full control |
| 2025-03-18 | Cloudflare Tunnel (not open ports) | Security, no router config needed |
| 2025-03-18 | Keep Express (not Next.js) | Preserve working 186-endpoint API, minimize risk |
| 2025-03-18 | Keep wouter (not Next.js router) | Frontend works well, no need to change |
| 2025-03-18 | New repo (not branch) | Clean start, no Replit artifacts |
| 2025-03-18 | Phase migration (Replit stays live) | Zero downtime cutover |
| 2025-03-18 | Backblaze B2 for backups | Cheapest (~$0.006/GB), rclone compatible |

---

## Pre-Build Checklist (Manual Steps)

These steps require human action before or during the build:

- [ ] Register domain via Cloudflare Registrar
- [ ] Create Cloudflare account → add domain
- [ ] Create Cloudflare Tunnel → get `TUNNEL_TOKEN`
- [ ] Set up Cloudflare Firewall rules for Greece-only access
- [ ] Generate SSH key on Mac Mini → add public key to GitHub repo secrets
- [ ] Install Docker Desktop (Apple Silicon) on Mac Mini
- [ ] Create Backblaze B2 bucket → get access key + secret
- [ ] Decide final domain name for the app

---

## Milestone Files

- [MILESTONE_01_REPO_AND_DOCKER.md](./MILESTONE_01_REPO_AND_DOCKER.md)
- [MILESTONE_02_CLEAN_BUILD.md](./MILESTONE_02_CLEAN_BUILD.md)
- [MILESTONE_03_ENV_CONFIG.md](./MILESTONE_03_ENV_CONFIG.md)
- [MILESTONE_04_REDIS_WIRING.md](./MILESTONE_04_REDIS_WIRING.md)
- [MILESTONE_05_GEOBLOCKING.md](./MILESTONE_05_GEOBLOCKING.md)
- [MILESTONE_06_DATABASE_SCHEMA.md](./MILESTONE_06_DATABASE_SCHEMA.md)
- [MILESTONE_07_BUG_FIXES.md](./MILESTONE_07_BUG_FIXES.md)
- [MILESTONE_08_ROUTES_SPLIT.md](./MILESTONE_08_ROUTES_SPLIT.md)
- [MILESTONE_09_CI_CD.md](./MILESTONE_09_CI_CD.md)
- [MILESTONE_10_BACKUP.md](./MILESTONE_10_BACKUP.md)
- [MILESTONE_11_DATA_MIGRATION.md](./MILESTONE_11_DATA_MIGRATION.md)
- [MILESTONE_12_FRONTEND_CLEANUP.md](./MILESTONE_12_FRONTEND_CLEANUP.md)
- [MILESTONE_13_AUTH_HARDENING.md](./MILESTONE_13_AUTH_HARDENING.md)
- [MILESTONE_14_API_STANDARDIZATION.md](./MILESTONE_14_API_STANDARDIZATION.md)
- [MILESTONE_15_QUERY_OPTIMIZATION.md](./MILESTONE_15_QUERY_OPTIMIZATION.md)
- [MILESTONE_16_STRUCTURED_LOGGING.md](./MILESTONE_16_STRUCTURED_LOGGING.md)
- [MILESTONE_17_SHARED_TYPE_CLEANUP.md](./MILESTONE_17_SHARED_TYPE_CLEANUP.md)
- [MILESTONE_18_TESTING_FOUNDATION.md](./MILESTONE_18_TESTING_FOUNDATION.md)
- [MILESTONE_19_SIDEBAR_FIX.md](./MILESTONE_19_SIDEBAR_FIX.md)
- [MILESTONE_20_WAREHOUSE_PICKING_UX.md](./MILESTONE_20_WAREHOUSE_PICKING_UX.md)
- [MILESTONE_21_DASHBOARD_V2.md](./MILESTONE_21_DASHBOARD_V2.md)
- [MILESTONE_22_ORDER_FORM_STREAMLINE.md](./MILESTONE_22_ORDER_FORM_STREAMLINE.md)
- [MILESTONE_23_TABLE_IMPROVEMENTS.md](./MILESTONE_23_TABLE_IMPROVEMENTS.md)
- [MILESTONE_24_SETTINGS_REORGANIZATION.md](./MILESTONE_24_SETTINGS_REORGANIZATION.md)
- [MILESTONE_25_NOTIFICATION_PERSISTENCE.md](./MILESTONE_25_NOTIFICATION_PERSISTENCE.md)
