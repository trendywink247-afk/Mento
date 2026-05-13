#!/usr/bin/env bash
# backup-pg.sh — Dump the Mento production Postgres database, compress it,
# optionally upload to S3/R2, and prune local copies older than 7 days.
#
# Usage:
#   /srv/mento/scripts/backup-pg.sh
#
# Required environment (sourced from .env.prod):
#   POSTGRES_USER      — Postgres superuser (default: mento)
#   POSTGRES_PASSWORD  — Postgres password
#   POSTGRES_DB        — Database name (default: mento)
#
# Optional environment:
#   BACKUP_S3_BUCKET   — If set, upload to s3://$BACKUP_S3_BUCKET/postgres/
#   BACKUP_S3_REGION   — AWS/R2 region (default: auto)
#   AWS_ACCESS_KEY_ID  — S3/R2 credentials
#   AWS_SECRET_ACCESS_KEY
#   AWS_ENDPOINT_URL   — For Cloudflare R2: https://<account>.r2.cloudflarestorage.com
#
# Cron recommendation:
#   0 2 * * * /srv/mento/scripts/backup-pg.sh >> /var/log/mento-backup.log 2>&1
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.prod"
BACKUP_DIR="/srv/mento/backups"
CONTAINER="mento-postgres-prod"
RETAIN_DAYS=7

# ── Load .env.prod ────────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Copy .env.prod.example and fill secrets." >&2
  exit 1
fi

# Source only the variables we need — avoid executing arbitrary content.
# Export individually so pg_dump subshell inherits them.
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-$(grep -E '^BACKUP_S3_BUCKET=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-$(grep -E '^BACKUP_S3_REGION=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$(grep -E '^AWS_ACCESS_KEY_ID=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$(grep -E '^AWS_SECRET_ACCESS_KEY=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)}"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-$(grep -E '^AWS_ENDPOINT_URL=' "${ENV_FILE}" | head -1 | cut -d= -f2- || true)}"

# Apply defaults for required vars
POSTGRES_USER="${POSTGRES_USER:-mento}"
POSTGRES_DB="${POSTGRES_DB:-mento}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

# ── Validate required variables ───────────────────────────────────────────────
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "ERROR: POSTGRES_PASSWORD is empty. Set it in ${ENV_FILE}." >&2
  exit 1
fi

# ── Verify the container is running ──────────────────────────────────────────
if ! docker inspect --format '{{.State.Running}}' "${CONTAINER}" 2>/dev/null | grep -q true; then
  echo "ERROR: Container '${CONTAINER}' is not running." >&2
  exit 1
fi

# ── Prepare backup directory ─────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="mento-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Run pg_dump ───────────────────────────────────────────────────────────────
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup: ${FILEPATH}"
logger -t mento-backup "Starting Postgres backup: ${FILEPATH}"

# PGPASSWORD is the standard env var pg_dump reads; pass it into docker exec
if ! docker exec \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" \
    "${CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${FILEPATH}"; then
  echo "ERROR: pg_dump failed." >&2
  logger -t mento-backup "ERROR: pg_dump failed"
  # Remove partial file if it exists
  rm -f "${FILEPATH}"
  exit 1
fi

# ── Verify the file is non-empty ─────────────────────────────────────────────
if [[ ! -s "${FILEPATH}" ]]; then
  echo "ERROR: Backup file is empty — aborting." >&2
  logger -t mento-backup "ERROR: Backup file empty: ${FILEPATH}"
  rm -f "${FILEPATH}"
  exit 1
fi

FILESIZE="$(du -sh "${FILEPATH}" | cut -f1)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup written: ${FILEPATH} (${FILESIZE})"
logger -t mento-backup "Backup OK: ${FILEPATH} (${FILESIZE})"

# ── Optional S3/R2 upload ─────────────────────────────────────────────────────
if [[ -n "${BACKUP_S3_BUCKET}" ]]; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploading to s3://${BACKUP_S3_BUCKET}/postgres/${FILENAME}"
  logger -t mento-backup "Uploading to s3://${BACKUP_S3_BUCKET}/postgres/${FILENAME}"

  # Build aws-cli endpoint arg for R2 / custom endpoints
  ENDPOINT_ARG=""
  if [[ -n "${AWS_ENDPOINT_URL}" ]]; then
    ENDPOINT_ARG="--endpoint-url=${AWS_ENDPOINT_URL}"
  fi

  export AWS_ACCESS_KEY_ID
  export AWS_SECRET_ACCESS_KEY
  export AWS_DEFAULT_REGION="${BACKUP_S3_REGION}"

  if ! aws s3 cp "${FILEPATH}" \
      "s3://${BACKUP_S3_BUCKET}/postgres/${FILENAME}" \
      ${ENDPOINT_ARG:+"${ENDPOINT_ARG}"}; then
    echo "WARNING: S3 upload failed. Local backup is still intact at ${FILEPATH}." >&2
    logger -t mento-backup "WARNING: S3 upload failed for ${FILENAME}"
    # Do not exit — local backup succeeded; operator should investigate upload failure.
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Upload OK: s3://${BACKUP_S3_BUCKET}/postgres/${FILENAME}"
    logger -t mento-backup "Upload OK: s3://${BACKUP_S3_BUCKET}/postgres/${FILENAME}"
  fi
else
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] BACKUP_S3_BUCKET not set — skipping remote upload."
fi

# ── Prune local backups older than RETAIN_DAYS days ──────────────────────────
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Pruning local backups older than ${RETAIN_DAYS} days..."
find "${BACKUP_DIR}" \
  -maxdepth 1 \
  -name 'mento-*.sql.gz' \
  -mtime "+${RETAIN_DAYS}" \
  -delete \
  -print \
  | while read -r pruned; do
      echo "  Pruned: ${pruned}"
      logger -t mento-backup "Pruned: ${pruned}"
    done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete. File: ${FILEPATH} (${FILESIZE})"
