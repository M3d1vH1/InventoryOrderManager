# Milestone 15 — Backup & Recovery

| Field | Value |
|-------|-------|
| **Step** | 15 of 25 |
| **Priority** | P2 |
| **Depends on** | Step 1 |
| **Estimated effort** | 0.5 days |

---

## Goal

Implement automated daily database backups using `pg_dump`, store them locally with 30-day rotation, and sync to Backblaze B2 for off-site storage using `rclone`. Provide a one-command restore procedure and verification scripts.

---

## Implementation

### 1. Backup Script — `scripts/backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="/opt/amphoreus-v2/backups"
DB_CONTAINER="amphoreus-v2-postgres-1"
DB_NAME="${POSTGRES_DB:-amphoreus}"
DB_USER="${POSTGRES_USER:-amphoreus}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="amphoreus_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30
B2_REMOTE="b2:amphoreus-backups"

echo "[$(date)] Starting backup..."

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Dump database (compressed)
docker exec "$DB_CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_DIR/$FILENAME"

FILE_SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "[$(date)] Backup created: $FILENAME ($FILE_SIZE)"

# Verify backup is not empty
if [ ! -s "$BACKUP_DIR/$FILENAME" ]; then
  echo "[$(date)] ERROR: Backup file is empty!"
  exit 1
fi

# Upload to Backblaze B2
if command -v rclone &> /dev/null; then
  rclone copy "$BACKUP_DIR/$FILENAME" "$B2_REMOTE/" --log-level INFO
  echo "[$(date)] Uploaded to Backblaze B2"
else
  echo "[$(date)] WARNING: rclone not installed, skipping B2 upload"
fi

# Rotate old local backups
find "$BACKUP_DIR" -name "amphoreus_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(find "$BACKUP_DIR" -name "amphoreus_*.sql.gz" | wc -l)
echo "[$(date)] Rotation complete. $REMAINING backups retained."

echo "[$(date)] Backup complete!"
```

### 2. Restore Script — `scripts/restore.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="amphoreus-v2-postgres-1"
DB_NAME="${POSTGRES_DB:-amphoreus}"
DB_USER="${POSTGRES_USER:-amphoreus}"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lth /opt/amphoreus-v2/backups/amphoreus_*.sql.gz 2>/dev/null | head -10
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  This will DROP and RECREATE the database '$DB_NAME'."
echo "    Backup file: $BACKUP_FILE"
read -p "    Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date)] Stopping application..."
docker compose stop app

echo "[$(date)] Dropping and recreating database..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS $DB_NAME;" \
  -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

echo "[$(date)] Restoring from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "[$(date)] Starting application..."
docker compose start app

echo "[$(date)] Restore complete!"
```

### 3. Backup Verification Script — `scripts/verify-backup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/amphoreus-v2/backups"
LATEST=$(ls -t "$BACKUP_DIR"/amphoreus_*.sql.gz 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "❌ No backups found"
  exit 1
fi

FILE_SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST")
FILE_DATE=$(stat -f%Sm -t"%Y-%m-%d %H:%M" "$LATEST" 2>/dev/null || stat -c%y "$LATEST" | cut -d. -f1)
TABLE_COUNT=$(gunzip -c "$LATEST" | grep -c "^CREATE TABLE" || true)

echo "Latest backup: $(basename "$LATEST")"
echo "  Size: $(numfmt --to=iec $FILE_SIZE 2>/dev/null || echo "${FILE_SIZE} bytes")"
echo "  Date: $FILE_DATE"
echo "  Tables: $TABLE_COUNT"

# Check age
FILE_AGE_HOURS=$(( ($(date +%s) - $(stat -f%m "$LATEST" 2>/dev/null || stat -c%Y "$LATEST")) / 3600 ))
if [ "$FILE_AGE_HOURS" -gt 25 ]; then
  echo "⚠️  WARNING: Latest backup is ${FILE_AGE_HOURS} hours old!"
  exit 1
else
  echo "✅ Backup is ${FILE_AGE_HOURS} hours old (within 25h threshold)"
fi
```

### 4. Cron Schedule

```bash
# Add to crontab on Mac Mini:
# Daily backup at 3:00 AM
0 3 * * * /opt/amphoreus-v2/scripts/backup.sh >> /opt/amphoreus-v2/logs/backup.log 2>&1

# Weekly backup verification (Monday 9 AM)
0 9 * * 1 /opt/amphoreus-v2/scripts/verify-backup.sh >> /opt/amphoreus-v2/logs/backup.log 2>&1
```

### 5. Rclone Configuration

```ini
# ~/.config/rclone/rclone.conf
[b2]
type = b2
account = ${B2_ACCOUNT_ID}
key = ${B2_APPLICATION_KEY}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `scripts/backup.sh` | Daily pg_dump + gzip + B2 upload + rotation |
| `scripts/restore.sh` | One-command restore from backup file |
| `scripts/verify-backup.sh` | Verify latest backup age and integrity |

---

## Verification

1. **Manual backup** — run `scripts/backup.sh`, confirm `.sql.gz` file created.
2. **File content** — decompress the backup, confirm it contains CREATE TABLE and INSERT statements.
3. **B2 upload** — confirm the backup appears in the Backblaze B2 bucket.
4. **Rotation** — create backups with old timestamps, run backup script, confirm old ones deleted.
5. **Restore** — restore from a backup to a fresh database, confirm all data is intact.
6. **Verify script** — run `scripts/verify-backup.sh`, confirm it reports age and table count.
7. **Stale alert** — set threshold to 1 hour, confirm the verify script warns about old backups.
8. **Cron** — check crontab, confirm daily backup schedule is configured.
9. **Empty backup** — simulate a pg_dump failure, confirm the script detects the empty file and exits with error.
10. **Restore safety** — run restore script, confirm it prompts for confirmation before dropping the database.

---

## Definition of Done

- [ ] `backup.sh` creates compressed pg_dump and uploads to Backblaze B2
- [ ] Backups rotate automatically (30-day local retention)
- [ ] `restore.sh` provides one-command restore with safety confirmation
- [ ] `verify-backup.sh` checks backup age and reports table count
- [ ] Empty/failed backups are detected and the script exits with error code
- [ ] Cron job scheduled for daily 3 AM backups
- [ ] Rclone configured for Backblaze B2 remote storage
- [ ] All scripts are executable and follow `set -euo pipefail`
