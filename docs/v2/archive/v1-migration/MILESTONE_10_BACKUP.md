# Milestone 10 — Automated Backups

**Priority:** P2
**Depends on:** Milestone 01 (Docker postgres container)
**Blocks:** Nothing

---

## Objective

Automated nightly pg_dump of the PostgreSQL database, uploaded to Backblaze B2 cloud storage, with 7-day rolling retention. Runs as a Docker service on the same compose stack.

---

## What Gets Backed Up

1. **Database** — Full PostgreSQL dump (schema + data)
2. **App storage** — Uploaded files (product images, labels, documents)

---

## Step 1 — Add Backup Service to `docker-compose.yml`

```yaml
# Add to docker-compose.yml services:

  # ============================================================
  # Backup Service — nightly pg_dump + rclone to Backblaze B2
  # ============================================================
  backup:
    image: alpine:latest
    container_name: amphoreus-backup
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_DB: amphoreus
      POSTGRES_USER: amphoreus
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      RCLONE_B2_ACCOUNT: ${B2_ACCOUNT_ID}
      RCLONE_B2_KEY: ${B2_APPLICATION_KEY}
      B2_BUCKET: ${B2_BUCKET_NAME}
      BACKUP_RETAIN_DAYS: 7
    volumes:
      - ./scripts/backup.sh:/backup.sh:ro
      - app_storage:/app/storage:ro
      - backup_temp:/tmp/backups
    networks:
      - internal
    depends_on:
      postgres:
        condition: service_healthy
    command: >
      sh -c "
        apk add --no-cache postgresql-client rclone tzdata &&
        echo '0 2 * * * /backup.sh >> /var/log/backup.log 2>&1' | crontab - &&
        crond -f
      "
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"
```

Add to volumes section:
```yaml
volumes:
  backup_temp:
    driver: local
```

---

## Step 2 — Create `scripts/backup.sh`

```bash
#!/bin/sh
# scripts/backup.sh
# Nightly backup script — runs inside the backup container
# Dumps PostgreSQL + syncs app storage to Backblaze B2

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/backups"
DB_BACKUP_FILE="$BACKUP_DIR/amphoreus_db_$TIMESTAMP.sql.gz"
STORAGE_BACKUP_FILE="$BACKUP_DIR/amphoreus_storage_$TIMESTAMP.tar.gz"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] BACKUP:"

echo "$LOG_PREFIX Starting backup..."

# ============================================================
# 1. Database backup
# ============================================================
echo "$LOG_PREFIX Dumping database..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "$DB_BACKUP_FILE"

DB_SIZE=$(du -sh "$DB_BACKUP_FILE" | cut -f1)
echo "$LOG_PREFIX Database dump complete: $DB_SIZE"

# ============================================================
# 2. Storage backup (uploaded files)
# ============================================================
echo "$LOG_PREFIX Archiving storage..."
tar -czf "$STORAGE_BACKUP_FILE" -C /app storage/
STORAGE_SIZE=$(du -sh "$STORAGE_BACKUP_FILE" | cut -f1)
echo "$LOG_PREFIX Storage archive complete: $STORAGE_SIZE"

# ============================================================
# 3. Configure rclone for Backblaze B2
# ============================================================
mkdir -p ~/.config/rclone

cat > ~/.config/rclone/rclone.conf << EOF
[b2]
type = b2
account = ${RCLONE_B2_ACCOUNT}
key = ${RCLONE_B2_KEY}
hard_delete = true
EOF

# ============================================================
# 4. Upload to Backblaze B2
# ============================================================
echo "$LOG_PREFIX Uploading to Backblaze B2..."
rclone copy "$DB_BACKUP_FILE" "b2:$B2_BUCKET/database/" --progress
rclone copy "$STORAGE_BACKUP_FILE" "b2:$B2_BUCKET/storage/" --progress
echo "$LOG_PREFIX Upload complete"

# ============================================================
# 5. Delete local temp files
# ============================================================
rm -f "$DB_BACKUP_FILE" "$STORAGE_BACKUP_FILE"

# ============================================================
# 6. Clean up old backups in B2 (retain only BACKUP_RETAIN_DAYS)
# ============================================================
echo "$LOG_PREFIX Cleaning up old backups (keeping last ${BACKUP_RETAIN_DAYS:-7} days)..."

CUTOFF_DATE=$(date -d "-${BACKUP_RETAIN_DAYS:-7} days" +%Y%m%d 2>/dev/null || \
              date -v-${BACKUP_RETAIN_DAYS:-7}d +%Y%m%d 2>/dev/null)

# List and delete database backups older than retention period
rclone ls "b2:$B2_BUCKET/database/" | while read size filename; do
  # Extract date from filename (format: amphoreus_db_YYYYMMDD_HHMMSS.sql.gz)
  FILE_DATE=$(echo "$filename" | grep -oE '[0-9]{8}' | head -1)
  if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
    echo "$LOG_PREFIX Deleting old backup: $filename"
    rclone deletefile "b2:$B2_BUCKET/database/$filename"
  fi
done

# List and delete storage backups older than retention period
rclone ls "b2:$B2_BUCKET/storage/" | while read size filename; do
  FILE_DATE=$(echo "$filename" | grep -oE '[0-9]{8}' | head -1)
  if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
    echo "$LOG_PREFIX Deleting old backup: $filename"
    rclone deletefile "b2:$B2_BUCKET/storage/$filename"
  fi
done

echo "$LOG_PREFIX Backup complete at $(date)"
```

Make executable:
```bash
chmod +x scripts/backup.sh
```

---

## Step 3 — Create `scripts/restore.sh`

```bash
#!/bin/bash
# scripts/restore.sh
# Restore from a specific backup date
# Usage: ./scripts/restore.sh 20250318

set -e

RESTORE_DATE="${1:-}"
if [ -z "$RESTORE_DATE" ]; then
  echo "Usage: $0 YYYYMMDD"
  echo "Example: $0 20250318"
  exit 1
fi

# Load env
source .env.production

echo "🔍 Finding backup for date: $RESTORE_DATE"

# Configure rclone
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf << EOF
[b2]
type = b2
account = ${B2_ACCOUNT_ID}
key = ${B2_APPLICATION_KEY}
EOF

# Find the backup file
BACKUP_FILE=$(rclone ls "b2:$B2_BUCKET_NAME/database/" | grep "$RESTORE_DATE" | awk '{print $2}' | head -1)

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ No backup found for date: $RESTORE_DATE"
  echo "Available backups:"
  rclone ls "b2:$B2_BUCKET_NAME/database/"
  exit 1
fi

echo "📥 Downloading: $BACKUP_FILE"
rclone copy "b2:$B2_BUCKET_NAME/database/$BACKUP_FILE" /tmp/

echo "⚠️  WARNING: This will REPLACE the current database!"
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Stop the app (keep postgres running)
docker compose stop app

# Restore the database
echo "🗄️  Restoring database..."
gunzip -c "/tmp/$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U amphoreus -d amphoreus

# Restart app
docker compose start app

echo "✅ Restore complete"
rm -f "/tmp/$BACKUP_FILE"
```

---

## Step 4 — Add Backup Env Vars to `.env.example`

```bash
# Add to .env.example:

# ============================================================
# BACKBLAZE B2 BACKUP
# ============================================================
# Get from: backblaze.com → App Keys → Create New Application Key
B2_ACCOUNT_ID=CHANGE_ME
B2_APPLICATION_KEY=CHANGE_ME
B2_BUCKET_NAME=amphoreus-backups

# Number of days to retain backups (default: 7)
BACKUP_RETAIN_DAYS=7
```

---

## Step 5 — Backblaze B2 Setup (Manual)

1. Go to [backblaze.com](https://www.backblaze.com/b2/cloud-storage.html)
2. Create account (free tier: 10GB)
3. Create a bucket: `amphoreus-backups` (private)
4. Create Application Key with read/write access to that bucket
5. Copy Account ID and Application Key to `.env.production`

**Cost estimate:** ~$0.006/GB/month
- Database dump: ~5MB compressed → nearly free
- Storage files: depends on number of images

---

## Verification

```bash
# Test backup manually (run inside the backup container)
docker compose exec backup /backup.sh

# Expected output:
# [timestamp] BACKUP: Starting backup...
# [timestamp] BACKUP: Dumping database...
# [timestamp] BACKUP: Database dump complete: 1.2M
# [timestamp] BACKUP: Archiving storage...
# [timestamp] BACKUP: Storage archive complete: 45M
# [timestamp] BACKUP: Uploading to Backblaze B2...
# [timestamp] BACKUP: Upload complete
# [timestamp] BACKUP: Cleaning up old backups (keeping last 7 days)...
# [timestamp] BACKUP: Backup complete at ...

# Verify backups in B2:
docker compose exec backup rclone ls b2:amphoreus-backups/database/
# Expected: file list with today's date
```

---

## Files Created in This Milestone

```
amphoreus-v2/
├── docker-compose.yml    ← MODIFIED: Add backup service + backup_temp volume
├── .env.example          ← MODIFIED: Add B2 vars
└── scripts/
    ├── backup.sh         ← NEW: Backup + upload script
    └── restore.sh        ← NEW: Restore from B2
```

---

## Next Milestone

→ [MILESTONE_11_DATA_MIGRATION.md](./MILESTONE_11_DATA_MIGRATION.md) — Migrate data from Replit to Mac Mini
