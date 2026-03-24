# Milestone 11 — Data Migration (Replit → Mac Mini)

**Priority:** P1 (one-time operation)
**Depends on:** Milestone 01 (Docker postgres running on Mac Mini)
**Blocks:** Go-live

---

## Objective

One-time migration of all PostgreSQL data from the Replit-hosted Neon database to the Mac Mini Docker PostgreSQL instance. Zero data loss, verified by row count comparison.

---

## Overview

```
Replit (Neon PostgreSQL)  →  pg_dump  →  .sql.gz file  →  transfer  →  Mac Mini Docker postgres
```

Estimated migration time: 5–15 minutes depending on data size.

---

## Step 1 — Dump from Neon (Run on Replit or Local Machine)

```bash
#!/bin/bash
# Run this wherever you have access to the Neon DATABASE_URL

# Set your Neon connection string
export NEON_DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/amphoreus?sslmode=require"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DUMP_FILE="amphoreus_migration_${TIMESTAMP}.sql"

echo "Dumping Neon database..."
pg_dump \
  "$NEON_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="$DUMP_FILE"

echo "Compressing..."
gzip "$DUMP_FILE"

echo "Done: ${DUMP_FILE}.gz"
ls -lh "${DUMP_FILE}.gz"
```

**Important flags:**
- `--no-owner` — strips `OWNER TO neon_user` statements that don't exist on Mac Mini
- `--no-acl` — strips GRANT/REVOKE statements
- `--format=plain` — produces a `.sql` file (not binary), easier to inspect and restore

---

## Step 2 — Transfer to Mac Mini

### Option A: scp (direct if on same network)
```bash
scp amphoreus_migration_*.sql.gz yourname@macmini-local-ip:~/
```

### Option B: USB drive
Copy `.sql.gz` to USB, plug into Mac Mini, copy to home directory.

### Option C: Via GitHub (if file < 100MB)
```bash
# Check size first
ls -lh amphoreus_migration_*.sql.gz

# If < 100MB, you can temporarily add to repo (gitignored after):
# But prefer scp or USB for security (contains real data)
```

---

## Step 3 — Pre-Restore Checks on Mac Mini

```bash
# 1. Verify Docker postgres is running and healthy
docker compose ps
# Expected: postgres is "healthy"

# 2. Check current database is empty (V2 fresh start)
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
# Expected: tables exist (from init schema) but all empty

# 3. Check the dump file arrived
ls -lh ~/amphoreus_migration_*.sql.gz
```

---

## Step 4 — Restore to Mac Mini Docker Postgres

```bash
#!/bin/bash
# Run on Mac Mini

DUMP_FILE=$(ls ~/amphoreus_migration_*.sql.gz | head -1)

if [ -z "$DUMP_FILE" ]; then
  echo "Error: No dump file found in home directory"
  exit 1
fi

echo "Restoring from: $DUMP_FILE"

# Stop the app (keep postgres running)
docker compose stop app

# Restore the database
# The | feeds the decompressed SQL directly into psql
gunzip -c "$DUMP_FILE" | docker compose exec -T postgres \
  psql -U amphoreus -d amphoreus \
  --set ON_ERROR_STOP=1

echo "Restore complete"
```

**Note:** `--set ON_ERROR_STOP=1` causes psql to abort on the first error instead of silently continuing. If the migration ran before (e.g., second attempt), drop and recreate first — see Step 5.

---

## Step 5 — If Restore Fails (Clean Retry)

```bash
# Drop and recreate the database (all data lost — only use for retries)
docker compose exec postgres psql -U amphoreus -d postgres \
  -c "DROP DATABASE IF EXISTS amphoreus;"
docker compose exec postgres psql -U amphoreus -d postgres \
  -c "CREATE DATABASE amphoreus OWNER amphoreus;"

# Re-run the migration SQL first (schema + V2 constraints)
docker compose exec -T postgres psql -U amphoreus -d amphoreus \
  < migrations/init/001_v2_schema.sql

# Then restore data
gunzip -c ~/amphoreus_migration_*.sql.gz | docker compose exec -T postgres \
  psql -U amphoreus -d amphoreus --set ON_ERROR_STOP=1
```

---

## Step 6 — Verify Row Counts Match

Run this query on **both Neon and Mac Mini** and compare:

```sql
-- Run on Neon (source) AND Mac Mini (destination) — results must match
SELECT
  tablename,
  (xpath('/row/c/text()',
    query_to_xml(format('select count(*) as c from %I', tablename), false, true, ''))
  )[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**On Mac Mini via Docker:**
```bash
docker compose exec postgres psql -U amphoreus -d amphoreus -c "
SELECT
  tablename,
  (xpath('/row/c/text()',
    query_to_xml(format('select count(*) as c from %I', tablename), false, true, ''))
  )[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

Expected: All table row counts identical between Neon and Mac Mini.

---

## Step 7 — Verify App Functionality

```bash
# Start the app
docker compose start app

# Wait for health check
sleep 10
curl http://localhost:5000/api/health
# Expected: {"status":"ok"}

# Check specific data
curl -s http://localhost:5000/api/products | python3 -m json.tool | head -20
# Expected: Real product data visible

# Tail app logs for errors
docker compose logs app --tail=50 --follow
```

---

## Step 8 — Migrate App Storage (Uploaded Files)

Product images and documents are stored in Replit's filesystem, not the database.

```bash
# On Replit, archive the storage directory:
tar -czf amphoreus_storage.tar.gz -C /home/runner/InventoryOrderManager/uploads .

# Transfer to Mac Mini (scp or USB)
scp amphoreus_storage.tar.gz yourname@macmini-ip:~/

# On Mac Mini, extract into the Docker volume mount:
# First find where the volume is mounted
docker volume inspect inventoryordermanager_app_storage
# Look for "Mountpoint"

# Extract files
mkdir -p /path/to/volume/mountpoint
tar -xzf ~/amphoreus_storage.tar.gz -C /path/to/volume/mountpoint/

# Or copy via docker cp:
docker cp ~/amphoreus_storage.tar.gz amphoreus-app:/tmp/
docker compose exec app sh -c "cd /app/uploads && tar -xzf /tmp/amphoreus_storage.tar.gz"
```

---

## Step 9 — DNS Cutover

After verifying data integrity and app functionality:

1. Update Cloudflare DNS to point your domain to the new tunnel
2. Verify HTTPS works: `curl https://your-domain.com/api/health`
3. Keep Replit running for 24h as fallback
4. Decommission Replit after 24h of confirmed stability

---

## Rollback Plan

If critical issues are found after cutover:

```bash
# Re-point Cloudflare DNS back to Replit tunnel
# Takes effect within seconds (Cloudflare proxied records TTL = 5 minutes)
# Replit instance is unaffected since we only did a read (pg_dump)
```

---

## Migration Checklist

```
[ ] Neon pg_dump completed without errors
[ ] Dump file transferred to Mac Mini
[ ] Docker postgres healthy
[ ] Restore completed without errors
[ ] Row counts match between Neon and Mac Mini (all tables)
[ ] App starts successfully (health check passes)
[ ] Spot-check: Log in, view products, view orders
[ ] Storage files migrated (images visible)
[ ] Cloudflare DNS updated to new tunnel
[ ] HTTPS working on custom domain
[ ] Replit kept as fallback for 24h
[ ] Replit decommissioned after 24h
```

---

## Files Created in This Milestone

```
amphoreus-v2/
└── scripts/
    └── migrate.sh    ← OPTIONAL: Wraps steps 1-6 into a single script
```

No code changes required — this is purely an operational procedure.

---

## Next Milestone

→ [MILESTONE_12_FRONTEND_CLEANUP.md](./MILESTONE_12_FRONTEND_CLEANUP.md) — Remove debug pages, fix known frontend issues
