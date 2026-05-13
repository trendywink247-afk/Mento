#!/usr/bin/env bash
# restore-pg.sh — Restore a Mento Postgres backup into the production container.
#
# Usage:
#   /srv/mento/scripts/restore-pg.sh [options] <backup-file.sql.gz>
#
# Options:
#   -y, --yes     Skip interactive confirmation prompt (required in non-TTY environments)
#   --force       Proceed even if the API container is currently healthy
#
# Examples:
#   # Interactive (will prompt for Y/N)
#   /srv/mento/scripts/restore-pg.sh /srv/mento/backups/mento-20260513-020001.sql.gz
#
#   # Non-interactive (CI, automated DR test)
#   /srv/mento/scripts/restore-pg.sh -y /srv/mento/backups/mento-20260513-020001.sql.gz
#
#   # Force restore even with API healthy (dangerous — data loss possible)
#   /srv/mento/scripts/restore-pg.sh --force -y /srv/mento/backups/mento-20260513-020001.sql.gz
#
# Required environment (sourced from .env.prod):
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
set -euo pipefail

# ── Argument parsing ──────────────────────────────────────────────────────────
CONFIRMED=false
FORCE=false
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)
      CONFIRMED=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    -*)
      echo "ERROR: Unknown option: $1" >&2
      echo "Usage: $0 [-y|--yes] [--force] <backup-file.sql.gz>" >&2
      exit 1
      ;;
    *)
      BACKUP_FILE="$1"
      shift
      ;;
  esac
done

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "ERROR: No backup file specified." >&2
  echo "Usage: $0 [-y|--yes] [--force] <backup-file.sql.gz>" >&2
  exit 1
fi

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.prod"
CONTAINER="mento-postgres-prod"
API_CONTAINER="mento-api-prod"

# ── Load .env.prod ────────────────────────────────────────────────────────────
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Copy .env.prod.example and fill secrets." >&2
  exit 1
fi

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"

POSTGRES_USER="${POSTGRES_USER:-mento}"
POSTGRES_DB="${POSTGRES_DB:-mento}"

if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "ERROR: POSTGRES_PASSWORD is empty in ${ENV_FILE}." >&2
  exit 1
fi

# ── Validate the backup file ──────────────────────────────────────────────────
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ ! -r "${BACKUP_FILE}" ]]; then
  echo "ERROR: Backup file is not readable: ${BACKUP_FILE}" >&2
  exit 1
fi

# Quick sanity-check: gzip magic bytes
if ! file "${BACKUP_FILE}" | grep -q 'gzip compressed'; then
  echo "ERROR: File does not appear to be gzip-compressed: ${BACKUP_FILE}" >&2
  exit 1
fi

# ── Verify Postgres container is running ──────────────────────────────────────
if ! docker inspect --format '{{.State.Running}}' "${CONTAINER}" 2>/dev/null | grep -q true; then
  echo "ERROR: Container '${CONTAINER}' is not running. Start the stack first." >&2
  exit 1
fi

# ── Check API container health (safety gate) ─────────────────────────────────
API_HEALTHY=false
if docker inspect --format '{{.State.Health.Status}}' "${API_CONTAINER}" 2>/dev/null | grep -q 'healthy'; then
  API_HEALTHY=true
fi

if [[ "${API_HEALTHY}" == "true" ]] && [[ "${FORCE}" == "false" ]]; then
  echo ""
  echo "  *** SAFETY GATE ***"
  echo ""
  echo "  The API container (${API_CONTAINER}) is currently healthy and serving traffic."
  echo "  Restoring while the API is live will corrupt in-flight writes and"
  echo "  cause immediate data loss."
  echo ""
  echo "  To proceed anyway (e.g. post-drain restore), re-run with --force:"
  echo "    $0 --force $*"
  echo ""
  echo "  Recommended steps:"
  echo "    1. Stop the API:  docker stop ${API_CONTAINER}"
  echo "    2. Run this restore script."
  echo "    3. Restart the stack: docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d"
  echo ""
  exit 1
fi

if [[ "${API_HEALTHY}" == "true" ]] && [[ "${FORCE}" == "true" ]]; then
  echo "WARNING: --force specified. Restoring while API is healthy. Proceeding." >&2
fi

# ── Warning banner ────────────────────────────────────────────────────────────
FILESIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║            DESTRUCTIVE OPERATION — READ CAREFULLY           ║"
echo "  ╠══════════════════════════════════════════════════════════════╣"
echo "  ║  This script will DROP and recreate all tables in:          ║"
echo "  ║    database : ${POSTGRES_DB}"
echo "  ║    container: ${CONTAINER}"
echo "  ║    backup   : $(basename "${BACKUP_FILE}")"
echo "  ║    size     : ${FILESIZE}"
echo "  ║                                                              ║"
echo "  ║  ALL CURRENT DATA IN THE DATABASE WILL BE OVERWRITTEN.      ║"
echo "  ║  This operation cannot be undone.                           ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Confirmation ──────────────────────────────────────────────────────────────
if [[ "${CONFIRMED}" == "false" ]]; then
  read -rp "  Type YES to continue, anything else to abort: " REPLY
  if [[ "${REPLY}" != "YES" ]]; then
    echo "Aborted."
    exit 0
  fi
else
  echo "  (-y flag set — skipping interactive prompt)"
fi
echo ""

# ── Run restore ───────────────────────────────────────────────────────────────
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting restore from: ${BACKUP_FILE}"
logger -t mento-restore "Starting restore from: ${BACKUP_FILE}"

if ! gunzip -c "${BACKUP_FILE}" \
  | docker exec \
      -i \
      -e PGPASSWORD="${POSTGRES_PASSWORD}" \
      "${CONTAINER}" \
      psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
      --set ON_ERROR_STOP=on; then
  echo "ERROR: Restore failed. The database may be in a partially restored state." >&2
  echo "       Check pg logs: docker logs ${CONTAINER}" >&2
  logger -t mento-restore "ERROR: Restore failed from ${BACKUP_FILE}"
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore SQL executed successfully."
logger -t mento-restore "Restore SQL executed: ${BACKUP_FILE}"

# ── Verify restore by counting User rows ─────────────────────────────────────
echo ""
echo "Verifying restore..."
USER_COUNT="$(docker exec \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  "${CONTAINER}" \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --tuples-only --no-align \
  -c 'SELECT count(*) FROM "User";' 2>&1)"

if [[ $? -ne 0 ]]; then
  echo "WARNING: Could not verify row count. Manual check recommended." >&2
  logger -t mento-restore "WARNING: post-restore verification query failed"
else
  echo "  User row count after restore: ${USER_COUNT}"
  logger -t mento-restore "Post-restore User count: ${USER_COUNT}"
fi

echo ""
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore complete."
echo ""
echo "Next steps:"
echo "  1. Run any pending migrations (if restoring to a newer schema version):"
echo "     docker exec mento-api-prod sh -c \\"
echo "       'DATABASE_URL=\$MIGRATIONS_DATABASE_URL node node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'"
echo "  2. Restart the full stack:"
echo "     docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d"
echo "  3. Verify API health: curl https://api.mento.in/healthz"
echo ""
