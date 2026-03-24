# Amphoreus V2 — Master Plan (Ground-Up Rewrite)

**Document Version:** 2.0
**Created:** 2026-03-18
**Status:** Active
**Branch:** `claude/plan-v2-architecture-zCS4D`
**Approach:** Clean-room rewrite — zero V1 code carried over, database data ported

---

## What Is Amphoreus?

A warehouse management system for a **Greek food/beverage distribution company** (olive oil production + distribution). It manages:
- Order management, picking, and shipping
- Inventory control & barcode scanning
- Supplier invoices & payments
- Production facility operations (olive oil)
- CRM & call tracking
- Shipping label printing (PDF / CAB printer)
- Slack notifications & daily reports

**V1 Host:** Replit (cloud PaaS) — React 18 + Express + Neon PostgreSQL + Drizzle ORM
**V2 Host:** Self-hosted Mac Mini M4 via Docker + Cloudflare Tunnel

---

## Why a Ground-Up Rewrite?

V1 has ~40 tables, 186 endpoints, and 15,000+ lines of server code. But the codebase has accumulated enough structural debt that refactoring would take longer than rebuilding:

- `routes.ts` is 5,374 lines — all 186 endpoints in one file, untestable
- `storage.postgresql.ts` is 5,014 lines — a monolithic query layer
- 60+ routes have no authentication — the API is effectively public
- Zero foreign key constraints — orphaned records everywhere
- Zero test coverage — no test framework installed
- Stock deducted at order creation, not picking — critical business logic bug
- Three different API response shapes — frontend uses `as any` to compensate
- Redis installed but never wired — cache falls back to in-memory
- Sidebar uses `window.location.href` and `document.getElementById` — breaks React

A clean rewrite lets us:
1. Use a modern, type-safe stack from day one
2. Design the API layer correctly (tRPC — zero `as any`)
3. Build the database schema with constraints from the start
4. Ship with auth, logging, and tests baked in — not bolted on
5. Design the UI for the actual users (warehouse workers on tablets, office staff on desktop)

---

## V2 Tech Stack

### Backend
| Technology | Role |
|---|---|
| **Node.js 22** | Runtime |
| **Hono** | HTTP framework (TypeScript-native, fast, Express-like API) |
| **tRPC v11** | End-to-end type-safe API layer (no fetch, no URL strings) |
| **Drizzle ORM** | Database queries + schema definition + type generation |
| **PostgreSQL 16** | Primary database (Docker container) |
| **Redis 7** | Caching layer (Docker container) |
| **Lucia Auth** | Session-based authentication (modern, TypeScript-native) |
| **Zod** | Validation (works natively with tRPC + Drizzle) |
| **Winston** | Structured logging (JSON in production, pretty in dev) |

### Frontend
| Technology | Role |
|---|---|
| **React 19** | UI framework (with compiler optimizations) |
| **Vite 6** | Build tool + dev server |
| **TanStack Router** | Type-safe file-based routing |
| **TanStack Query** | Server state (via tRPC's built-in integration) |
| **shadcn/ui** | Component library (Radix primitives + Tailwind) |
| **Tailwind CSS v4** | Styling |
| **React Hook Form + Zod** | Form validation |

### Infrastructure
| Technology | Role |
|---|---|
| **Docker Compose** | Multi-service orchestration |
| **Cloudflare Tunnel** | Zero-port HTTPS ingress |
| **Cloudflare WAF** | Geoblocking at edge |
| **GitHub Actions** | CI/CD (push-to-deploy) |
| **Backblaze B2** | Cloud backup (pg_dump + rclone) |

### Key Architecture: End-to-End Type Safety

```
Drizzle Schema  →  tRPC Router  →  React Client
  (DB types)      (API types)     (auto-inferred)

No manual type definitions needed between layers.
Change a column → TypeScript error in the UI component → fix it → done.
```

---

## Architecture Diagram

```
Internet
  └── Cloudflare (DNS + SSL + WAF/Geoblocking)
        └── Cloudflare Tunnel (zero open ports)
              └── Mac Mini M4
                    └── Docker Compose
                          ├── amphoreus-app   (Hono + tRPC + React, port 3000 internal)
                          ├── postgres:16     (PostgreSQL, internal only)
                          ├── redis:7         (Redis, internal only)
                          └── cloudflared     (Tunnel daemon)
```

---

## Repository Structure

```
amphoreus-v2/
├── src/
│   ├── server/
│   │   ├── index.ts              # Hono app entry point
│   │   ├── trpc.ts               # tRPC initialization (context, middleware)
│   │   ├── router.ts             # Root tRPC router (merges all domain routers)
│   │   ├── routers/              # Domain-specific tRPC routers
│   │   │   ├── auth.ts
│   │   │   ├── orders.ts
│   │   │   ├── products.ts
│   │   │   ├── inventory.ts
│   │   │   ├── customers.ts
│   │   │   ├── picking.ts
│   │   │   ├── shipping.ts
│   │   │   ├── suppliers.ts
│   │   │   ├── production.ts
│   │   │   ├── crm.ts
│   │   │   ├── reports.ts
│   │   │   └── settings.ts
│   │   ├── services/             # Business logic (reusable across routers)
│   │   │   ├── stockService.ts   # Stock reservation + picking logic
│   │   │   ├── orderService.ts   # Order lifecycle + status transitions
│   │   │   └── labelService.ts   # PDF label generation
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle table definitions (all tables)
│   │   │   ├── index.ts          # DB connection pool
│   │   │   └── seed.ts           # Dev seed data
│   │   ├── auth/
│   │   │   ├── lucia.ts          # Lucia configuration
│   │   │   └── middleware.ts     # Auth middleware for tRPC
│   │   └── lib/
│   │       ├── cache.ts          # Redis cache wrapper
│   │       ├── logger.ts         # Winston setup
│   │       └── env.ts            # Environment validation (Zod)
│   │
│   ├── client/
│   │   ├── main.tsx              # React entry
│   │   ├── App.tsx               # Root component (providers)
│   │   ├── router.tsx            # TanStack Router config
│   │   ├── routes/               # File-based routes
│   │   │   ├── __root.tsx        # Root layout (sidebar + header)
│   │   │   ├── _auth.tsx         # Auth layout guard
│   │   │   ├── _auth/
│   │   │   │   ├── index.tsx     # Dashboard
│   │   │   │   ├── orders/
│   │   │   │   │   ├── index.tsx
│   │   │   │   │   ├── new.tsx
│   │   │   │   │   └── $orderId.tsx
│   │   │   │   ├── products/
│   │   │   │   ├── customers/
│   │   │   │   ├── picking/
│   │   │   │   ├── inventory/
│   │   │   │   └── settings/
│   │   │   └── login.tsx
│   │   ├── components/
│   │   │   ├── ui/               # shadcn/ui primitives
│   │   │   ├── layout/           # Sidebar, Header, PageShell
│   │   │   ├── orders/
│   │   │   ├── products/
│   │   │   ├── picking/
│   │   │   └── shared/           # EmptyState, DataTable, etc.
│   │   ├── lib/
│   │   │   ├── trpc.ts           # tRPC client + React Query provider
│   │   │   └── utils.ts          # Shared utilities
│   │   └── styles/
│   │       └── globals.css       # Tailwind base + custom styles
│   │
│   └── shared/
│       └── types.ts              # Shared types inferred from Drizzle schema
│
├── migrations/                   # Drizzle migration files
├── docker-compose.yml
├── docker-compose.dev.yml
├── Dockerfile
├── .env.example
├── vite.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── package.json
└── vitest.config.ts
```

---

## Feature Phases

### Phase 1 — Core (Steps 1–12)
What the business needs to operate day-to-day:
- Auth (login, roles)
- Products & inventory (with correct stock reservation model)
- Customers
- Orders (create, edit, status workflow)
- Order picking (mobile-first, card-based)
- Shipping labels (PDF)
- Barcode scanning
- Dashboard (live stats)

### Phase 2 — Extended (Steps 18–25)
Features that enhance operations but aren't required for launch:
- Supplier payments & invoices
- Production module (recipes, batches, materials)
- CRM & call logs
- Reports & analytics
- Inventory predictions & reorder alerts
- Calendar & scheduling
- Slack integrations & notifications system
- Settings & admin panel

### Infrastructure (Steps 13–17)
Cross-cutting concerns that run in parallel with features:
- Redis caching
- CI/CD pipeline
- Backup strategy
- Cloudflare Tunnel + go-live
- Data migration from Neon

---

## Milestone Overview

| # | Milestone | Phase | Priority |
|---|-----------|-------|----------|
| 01 | Repo + Docker + Dev Environment | Foundation | **P0** |
| 02 | Database Schema | Foundation | **P0** |
| 03 | Backend Core (Hono + tRPC) | Foundation | **P0** |
| 04 | Auth System (Lucia) | Foundation | **P0** |
| 05 | Frontend Shell (React + Router + Layout) | Foundation | **P0** |
| 06 | Products & Inventory | Core | **P1** |
| 07 | Customers | Core | **P1** |
| 08 | Orders | Core | **P1** |
| 09 | Order Picking | Core | **P1** |
| 10 | Shipping Labels | Core | **P1** |
| 11 | Barcode Scanning | Core | **P1** |
| 12 | Dashboard | Core | **P1** |
| 13 | Redis Caching | Infra | **P2** |
| 14 | CI/CD Pipeline | Infra | **P2** |
| 15 | Backup & Recovery | Infra | **P2** |
| 16 | Cloudflare Tunnel + Go-Live | Infra | **P1** |
| 17 | Data Migration (Neon → V2) | Infra | **P1** |
| 18 | Supplier Payments & Invoices | Extended | **P2** |
| 19 | Production Module | Extended | **P2** |
| 20 | CRM & Call Logs | Extended | **P2** |
| 21 | Reports & Analytics | Extended | **P2** |
| 22 | Inventory Predictions | Extended | **P3** |
| 23 | Calendar & Scheduling | Extended | **P3** |
| 24 | Slack Integrations & Notifications | Extended | **P2** |
| 25 | Settings & Admin Panel | Extended | **P2** |

---

## V1 Database — What Gets Ported

The V1 Neon database has 39 tables. All **data** will be migrated via `pg_dump` + transform script. The V2 **schema** is new (same tables, but with FK constraints, CHECK constraints, `reserved_stock`, and proper indexes from day one).

### V1 Tables by Phase

**Phase 1 (Core — built first):**
users, products, categories, tags, productTags, orders, orderItems, customers, shippingDocuments, inventoryChanges, barcodeScanLogs, unshippedItems, orderChangelogs, orderQuality, sessions

**Phase 2 (Extended — built later):**
suppliers, supplierInvoices, supplierPayments, supplierInvoiceChangelogs, supplierPaymentChangelogs, rawMaterials, productionBatches, productionRecipes, recipeIngredients, productionOrders, materialConsumptions, productionLogs, materialInventoryChanges, productionQualityChecks, callLogs, prospectiveCustomers, callOutcomes, inventoryHistory, inventoryPredictions, seasonalPatterns

**Settings (built in Phase 2, Step 25):**
emailSettings, companySettings, notificationSettings, rolePermissions

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Ground-up rewrite, not migration | V1 has too much structural debt to refactor efficiently |
| Hono over Express | TypeScript-native, faster, same API patterns |
| tRPC over REST | Zero `as any`, end-to-end types, eliminates fetch boilerplate |
| TanStack Router over wouter | Type-safe routes, file-based, catches typos at compile time |
| Lucia over Passport.js | Modern session auth, less boilerplate, built for TypeScript |
| Monorepo (single package.json) | Simple — no need for Turborepo/Nx at this scale |
| Same DB, new schema | Keep all business data, but add FK/CHECK constraints from day one |
| Phase 1 first, Phase 2 later | Ship core operations ASAP, add extended features incrementally |

---

## Pre-Build Checklist (Manual Steps)

- [ ] Create `amphoreus-v2` GitHub repo (private)
- [ ] Install Docker Desktop on Mac Mini M4
- [ ] Register/configure domain in Cloudflare
- [ ] Create Cloudflare Tunnel → get `TUNNEL_TOKEN`
- [ ] Set up Cloudflare WAF rule for geoblocking (Greece + Cyprus)
- [ ] Generate SSH key on Mac Mini → add to GitHub deploy keys
- [ ] Create Backblaze B2 bucket → get access credentials
- [ ] Decide final domain name

---

## Milestone Files

### Foundation
- [MILESTONE_01_REPO_DOCKER_SETUP.md](./MILESTONE_01_REPO_DOCKER_SETUP.md)
- [MILESTONE_02_DATABASE_SCHEMA.md](./MILESTONE_02_DATABASE_SCHEMA.md)
- [MILESTONE_03_BACKEND_CORE.md](./MILESTONE_03_BACKEND_CORE.md)
- [MILESTONE_04_AUTH_SYSTEM.md](./MILESTONE_04_AUTH_SYSTEM.md)
- [MILESTONE_05_FRONTEND_SHELL.md](./MILESTONE_05_FRONTEND_SHELL.md)

### Core Features
- [MILESTONE_06_PRODUCTS_INVENTORY.md](./MILESTONE_06_PRODUCTS_INVENTORY.md)
- [MILESTONE_07_CUSTOMERS.md](./MILESTONE_07_CUSTOMERS.md)
- [MILESTONE_08_ORDERS.md](./MILESTONE_08_ORDERS.md)
- [MILESTONE_09_ORDER_PICKING.md](./MILESTONE_09_ORDER_PICKING.md)
- [MILESTONE_10_SHIPPING_LABELS.md](./MILESTONE_10_SHIPPING_LABELS.md)
- [MILESTONE_11_BARCODE_SCANNING.md](./MILESTONE_11_BARCODE_SCANNING.md)
- [MILESTONE_12_DASHBOARD.md](./MILESTONE_12_DASHBOARD.md)

### Infrastructure
- [MILESTONE_13_REDIS_CACHING.md](./MILESTONE_13_REDIS_CACHING.md)
- [MILESTONE_14_CI_CD.md](./MILESTONE_14_CI_CD.md)
- [MILESTONE_15_BACKUP.md](./MILESTONE_15_BACKUP.md)
- [MILESTONE_16_CLOUDFLARE_GOLIVE.md](./MILESTONE_16_CLOUDFLARE_GOLIVE.md)
- [MILESTONE_17_DATA_MIGRATION.md](./MILESTONE_17_DATA_MIGRATION.md)

### Extended Features
- [MILESTONE_18_SUPPLIER_PAYMENTS.md](./MILESTONE_18_SUPPLIER_PAYMENTS.md)
- [MILESTONE_19_PRODUCTION.md](./MILESTONE_19_PRODUCTION.md)
- [MILESTONE_20_CRM_CALL_LOGS.md](./MILESTONE_20_CRM_CALL_LOGS.md)
- [MILESTONE_21_REPORTS_ANALYTICS.md](./MILESTONE_21_REPORTS_ANALYTICS.md)
- [MILESTONE_22_INVENTORY_PREDICTIONS.md](./MILESTONE_22_INVENTORY_PREDICTIONS.md)
- [MILESTONE_23_CALENDAR.md](./MILESTONE_23_CALENDAR.md)
- [MILESTONE_24_SLACK_NOTIFICATIONS.md](./MILESTONE_24_SLACK_NOTIFICATIONS.md)
- [MILESTONE_25_SETTINGS_ADMIN.md](./MILESTONE_25_SETTINGS_ADMIN.md)

---

## V1 Reference (archived)

The original migration-based milestone plan (25 files) is archived at:
`docs/v2/archive/v1-migration/`

The V1 codebase at `/home/user/InventoryOrderManager` is reference-only for understanding business logic and data model. No V1 code is carried into V2.
