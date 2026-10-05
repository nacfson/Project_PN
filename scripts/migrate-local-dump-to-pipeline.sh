#!/usr/bin/env bash
# Restore a local Project PN Postgres dump into nacfson_pipeline database proj_pn.
#
# Prerequisites:
#   - pg_restore, psql, gzip (and optionally tar) on PATH
#   - Admin access to pipeline Postgres (port-forward recommended):
#       kubectl -n identity port-forward svc/postgres 5432:5432
#
# Usage:
#   scripts/migrate-local-dump-to-pipeline.sh /path/to/dump.tar.gz
#   scripts/migrate-local-dump-to-pipeline.sh /path/to/dump.dump.gz
#   TARGET_PORT=15432 scripts/migrate-local-dump-to-pipeline.sh ./pn-prod.dump.gz
#
# Env:
#   TARGET_HOST   default localhost
#   TARGET_PORT   default 5432
#   TARGET_DB     default proj_pn
#   TARGET_USER   default postgres (admin role for restore + REASSIGN)
#   PGPASSWORD    admin password (required unless .pgpass / peer auth)

set -euo pipefail

DUMP_PATH="${1:-}"
if [[ -z "${DUMP_PATH}" || ! -f "${DUMP_PATH}" ]]; then
  echo "Usage: $0 <local-dump.tar.gz|dump.gz|dump>" >&2
  exit 1
fi

TARGET_HOST="${TARGET_HOST:-localhost}"
TARGET_PORT="${TARGET_PORT:-5432}"
TARGET_DB="${TARGET_DB:-proj_pn}"
TARGET_USER="${TARGET_USER:-postgres}"
OWNER_ROLE="${OWNER_ROLE:-user_pn}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "=== [Pipeline Ingest] Restoring ${DUMP_PATH} into ${TARGET_DB}@${TARGET_HOST}:${TARGET_PORT} ==="

SHA_SIDECAR="${DUMP_PATH}.sha256"
if [[ -f "${SHA_SIDECAR}" ]]; then
  echo "Verifying SHA-256 sidecar checksum..."
  (
    cd "$(dirname "${DUMP_PATH}")"
    sha256sum -c "$(basename "${SHA_SIDECAR}")"
  )
fi

WORK="${TMP_DIR}/payload"
mkdir -p "${WORK}"
case "${DUMP_PATH}" in
  *.tar.gz|*.tgz)
    echo "Extracting tar archive..."
    tar -xzf "${DUMP_PATH}" -C "${WORK}"
    ;;
  *.dump.gz|*.sql.gz|*.gz)
    echo "Decompressing gzip..."
    out="${WORK}/$(basename "${DUMP_PATH%.gz}")"
    gzip -dc "${DUMP_PATH}" > "${out}"
    ;;
  *)
    echo "Copying dump as-is..."
    cp "${DUMP_PATH}" "${WORK}/"
    ;;
esac

DUMP_FILE=""
# Prefer custom-format dumps, then plain SQL.
while IFS= read -r -d '' candidate; do
  case "${candidate}" in
    *.dump|*.backup|*.custom)
      DUMP_FILE="${candidate}"
      break
      ;;
  esac
done < <(find "${WORK}" -type f \( -name '*.dump' -o -name '*.backup' -o -name '*.custom' \) -print0 2>/dev/null || true)

if [[ -z "${DUMP_FILE}" ]]; then
  while IFS= read -r -d '' candidate; do
    DUMP_FILE="${candidate}"
    break
  done < <(find "${WORK}" -type f \( -name '*.sql' -o -name '*.dump' -o -name 'dump' \) -print0 2>/dev/null || true)
fi

if [[ -z "${DUMP_FILE}" ]]; then
  # Single file dropped into WORK without extension heuristics.
  DUMP_FILE="$(find "${WORK}" -type f | head -n 1 || true)"
fi

if [[ -z "${DUMP_FILE}" || ! -f "${DUMP_FILE}" ]]; then
  echo "ERROR: no restoreable dump file found inside ${DUMP_PATH}" >&2
  exit 1
fi

echo "Using dump file: ${DUMP_FILE}"

PG_ARGS=(-h "${TARGET_HOST}" -p "${TARGET_PORT}" -U "${TARGET_USER}" -d "${TARGET_DB}")

echo "Restoring into database '${TARGET_DB}'..."
case "${DUMP_FILE}" in
  *.sql)
    psql "${PG_ARGS[@]}" -v ON_ERROR_STOP=1 -f "${DUMP_FILE}"
    ;;
  *)
    pg_restore --clean --if-exists --no-owner --no-acl \
      "${PG_ARGS[@]}" \
      "${DUMP_FILE}"
    ;;
esac

echo "Re-assigning ownership to ${OWNER_ROLE}..."
psql "${PG_ARGS[@]}" -v ON_ERROR_STOP=1 -c \
  "REASSIGN OWNED BY CURRENT_USER TO ${OWNER_ROLE};"

echo "Row-count sanity checks:"
psql "${PG_ARGS[@]}" -v ON_ERROR_STOP=1 -c "
SELECT 'users' AS table, COUNT(*) FROM users
UNION ALL SELECT 'words', COUNT(*) FROM words
UNION ALL SELECT 'decks', COUNT(*) FROM decks
UNION ALL SELECT 'review_states', COUNT(*) FROM review_states
ORDER BY 1;
"

echo "✓ PASS: Historical data restored into pipeline database '${TARGET_DB}'."
