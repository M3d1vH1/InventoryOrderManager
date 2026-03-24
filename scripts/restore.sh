#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-amphoreus-v2-postgres-1}"
DB_NAME="${POSTGRES_DB:-amphoreus}"
DB_USER="${POSTGRES_USER:-amphoreus}"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  BACKUP_DIR="${BACKUP_DIR:-/opt/amphoreus-v2/backups}"
  ls -lth "$BACKUP_DIR"/amphoreus_*.sql.gz 2>/dev/null | head -10
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
