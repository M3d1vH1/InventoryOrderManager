# Milestone 01 — New Repository & Docker Infrastructure

**Priority:** P0 (must be done first)
**Depends on:** Nothing
**Blocks:** All other milestones

---

## Objective

Create the new `amphoreus-v2` GitHub repository with a working multi-service Docker Compose stack that runs the app, PostgreSQL 16, Redis 7, and the Cloudflare Tunnel daemon. By the end of this milestone you can run the entire stack locally with `docker compose up`.

---

## Step 1 — Create New GitHub Repository

```bash
# On your Mac Mini or local machine
# Create new repo at: github.com/[your-org]/amphoreus-v2
# Initialize with README only
# Clone it:
git clone git@github.com:[your-org]/amphoreus-v2.git
cd amphoreus-v2
```

---

## Step 2 — Copy Source Code from V1

```bash
# From the Replit repo (or downloaded zip)
# Copy these directories/files into amphoreus-v2/
cp -r /path/to/v1/client ./
cp -r /path/to/v1/server ./
cp -r /path/to/v1/shared ./
cp /path/to/v1/package.json ./
cp /path/to/v1/package-lock.json ./
cp /path/to/v1/tsconfig.json ./
cp /path/to/v1/tailwind.config.ts ./
cp /path/to/v1/postcss.config.js ./
cp /path/to/v1/drizzle.config.ts ./
cp /path/to/v1/theme.json ./

# Do NOT copy:
# - .replit
# - replit.nix
# - replit.nix.bak
# - replit.md
# - All test-*.js, debug-*.js, analyze-*.js files
# - build-*.sh scripts (we replace with npm scripts)
# - Any *.bak, *.backup files
# - dist/
# - node_modules/
```

---

## Step 3 — Create `.gitignore`

Create `/amphoreus-v2/.gitignore`:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build output
dist/
build/

# Environment files (never commit secrets)
.env
.env.local
.env.*.local
.env.production

# Keep the example
!.env.example

# Storage (uploaded files)
storage/
uploads/
public/uploads/
temp/
temp_labels/
temp_sounds/

# Logs
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Docker overrides
docker-compose.override.yml

# Replit artifacts (should not exist in v2, but just in case)
.replit
replit.nix
.config/

# Test artifacts
test-output.pdf
test-order.pdf
sample-pdf.pdf
*.pdf
!docs/**/*.pdf
```

---

## Step 4 — Create Multi-Stage `Dockerfile`

Create `/amphoreus-v2/Dockerfile`:

```dockerfile
# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

# ============================================================
# Stage 2: Build
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL deps (including devDeps for building)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend + backend
RUN npm run build

# ============================================================
# Stage 3: Production Runner
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs amphoreus

# Create storage directory with correct ownership
RUN mkdir -p /app/storage/uploads/products \
  && mkdir -p /app/storage/labels \
  && mkdir -p /app/storage/documents \
  && chown -R amphoreus:nodejs /app/storage

# Copy production deps from deps stage
COPY --from=deps --chown=amphoreus:nodejs /app/node_modules ./node_modules

# Copy built output from builder stage
COPY --from=builder --chown=amphoreus:nodejs /app/dist ./dist
COPY --from=builder --chown=amphoreus:nodejs /app/package.json ./

# Storage volume mount point
VOLUME ["/app/storage"]

USER amphoreus

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV STORAGE_PATH=/app/storage

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.js"]
```

---

## Step 5 — Create `docker-compose.yml`

Create `/amphoreus-v2/docker-compose.yml`:

```yaml
version: "3.9"

# ==============================================================
# Amphoreus V2 — Production Docker Compose
# Mac Mini M4 self-hosted deployment
# ==============================================================

services:
  # ============================================================
  # Application Server
  # ============================================================
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: amphoreus-app
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://amphoreus:${DB_PASSWORD}@postgres:5432/amphoreus
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      STORAGE_PATH: /app/storage
      APP_URL: ${APP_URL}
      SLACK_WEBHOOK_URL: ${SLACK_WEBHOOK_URL}
      SLACK_FINANCE_WEBHOOK_URL: ${SLACK_FINANCE_WEBHOOK_URL}
      ENABLE_GEOBLOCKING: "false"   # Handled by Cloudflare
      VERBOSE_LOGGING: "false"
    volumes:
      - app_storage:/app/storage
    networks:
      - internal
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ============================================================
  # PostgreSQL 16
  # ============================================================
  postgres:
    image: postgres:16-alpine
    container_name: amphoreus-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: amphoreus
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: amphoreus
      # Performance tuning for Mac Mini M4 (16GB RAM assumed)
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --locale=en_US.UTF-8"
    command: >
      postgres
        -c shared_buffers=256MB
        -c effective_cache_size=1GB
        -c maintenance_work_mem=64MB
        -c checkpoint_completion_target=0.9
        -c wal_buffers=16MB
        -c default_statistics_target=100
        -c random_page_cost=1.1
        -c effective_io_concurrency=200
        -c work_mem=4MB
        -c max_connections=50
        -c log_min_duration_statement=1000
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations/init:/docker-entrypoint-initdb.d
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U amphoreus -d amphoreus"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ============================================================
  # Redis 7
  # ============================================================
  redis:
    image: redis:7-alpine
    container_name: amphoreus-redis
    restart: unless-stopped
    command: >
      redis-server
        --save 60 1000
        --loglevel warning
        --maxmemory 256mb
        --maxmemory-policy allkeys-lru
        --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - internal
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

  # ============================================================
  # Cloudflare Tunnel Daemon
  # ============================================================
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: amphoreus-cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    networks:
      - internal
    depends_on:
      app:
        condition: service_healthy
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"

# ==============================================================
# Networks
# ==============================================================
networks:
  internal:
    driver: bridge
    internal: false   # App needs external access for Slack, email etc.

# ==============================================================
# Volumes
# ==============================================================
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH}/postgres    # e.g. /Users/yourname/amphoreus-data/postgres
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH}/redis
  app_storage:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${DATA_PATH}/storage
```

---

## Step 6 — Create `docker-compose.dev.yml`

Create `/amphoreus-v2/docker-compose.dev.yml`:

```yaml
# Development override — use with:
# docker compose -f docker-compose.yml -f docker-compose.dev.yml up
version: "3.9"

services:
  app:
    build:
      target: builder     # Use builder stage for hot reload
    environment:
      NODE_ENV: development
      VERBOSE_LOGGING: "true"
    command: npm run dev
    volumes:
      - .:/app
      - /app/node_modules  # Preserve container node_modules
    ports:
      - "5000:5000"        # Expose directly in dev

  postgres:
    ports:
      - "5432:5432"        # Expose for local DB tools (TablePlus, etc.)

  redis:
    ports:
      - "6379:6379"        # Expose for local Redis inspection
```

---

## Step 7 — Create Data Directory Structure on Mac Mini

Run this once on the Mac Mini before first `docker compose up`:

```bash
#!/bin/bash
# scripts/init-data-dirs.sh
# Run once on Mac Mini before first docker compose up

DATA_PATH="${DATA_PATH:-/Users/$(whoami)/amphoreus-data}"

mkdir -p "$DATA_PATH/postgres"
mkdir -p "$DATA_PATH/redis"
mkdir -p "$DATA_PATH/storage/uploads/products"
mkdir -p "$DATA_PATH/storage/labels"
mkdir -p "$DATA_PATH/storage/documents"
mkdir -p "$DATA_PATH/backups"

echo "Created data directories at $DATA_PATH"
echo "Add this to your .env.production:"
echo "DATA_PATH=$DATA_PATH"
```

---

## Step 8 — Verify Health Endpoint Exists

The Docker HEALTHCHECK requires `GET /api/health` to return HTTP 200.

Check if it exists in the current `server/routes.ts` or `server/index.ts`:

```bash
grep -n "api/health\|/health" server/routes.ts server/index.ts
```

If it doesn't exist or returns something other than 200, add this to `server/index.ts` **before** other routes:

```typescript
// Health check endpoint — used by Docker HEALTHCHECK
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '2.0.0'
  });
});
```

---

## Verification Checklist

After completing this milestone:

```bash
# 1. Build the Docker image
docker compose build

# 2. Start all services
docker compose up -d

# 3. Verify all containers are healthy
docker compose ps
# Expected: All 4 services show "healthy" or "running"

# 4. Check app logs
docker compose logs app --tail=50

# 5. Test health endpoint
curl http://localhost:5000/api/health
# Expected: {"status":"ok","timestamp":"...","version":"2.0.0"}

# 6. Check postgres is accessible
docker compose exec postgres psql -U amphoreus -d amphoreus -c "SELECT version();"

# 7. Check redis is accessible
docker compose exec redis redis-cli --pass $REDIS_PASSWORD ping
# Expected: PONG

# 8. Check cloudflared tunnel
docker compose logs cloudflared --tail=20
# Expected: "Connection established" or similar
```

---

## Files Created in This Milestone

```
amphoreus-v2/
├── Dockerfile                    ← NEW: multi-stage build
├── docker-compose.yml            ← NEW: production compose
├── docker-compose.dev.yml        ← NEW: dev override
├── .gitignore                    ← NEW: clean gitignore
└── scripts/
    └── init-data-dirs.sh         ← NEW: one-time Mac Mini setup
```

---

## Next Milestone

→ [MILESTONE_02_CLEAN_BUILD.md](./MILESTONE_02_CLEAN_BUILD.md) — Remove Replit plugins, fix vite.config.ts
