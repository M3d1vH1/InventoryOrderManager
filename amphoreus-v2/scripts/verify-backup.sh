#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/amphoreus-v2/backups}"
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
