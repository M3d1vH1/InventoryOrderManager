#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/amphoreus-v2/backups}"
DB_CONTAINER="${DB_CONTAINER:-amphoreus-v2-postgres-1}"
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
