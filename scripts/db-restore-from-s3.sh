#!/usr/bin/env bash
set -euo pipefail

# Restore a Project PN PostgreSQL dump from AWS S3 (or a local artifact).

usage() {
  cat <<'USAGE'
Usage:
  scripts/db-restore-from-s3.sh --s3-uri s3://bucket/key [options]
  scripts/db-restore-from-s3.sh --file PATH [options]
  scripts/db-restore-from-s3.sh --latest [options]
  scripts/db-restore-from-s3.sh --list

Download a dump artifact, verify SHA-256, decrypt/decompress if needed, and
restore into DATABASE_URL.

Modes:
  full   Restore schema + data with pg_restore --clean --if-exists (default).
         Use this for a PC-to-PC copy when the dump already includes schema.
         After restore, run migrate up only if git has newer migrations.
  data   Assume the target was already migrated. Truncate app tables (not
         schema_migrations) when --force, then pg_restore --data-only.

Options:
  --s3-uri URI           Exact S3 object to download (without .sha256).
  --file PATH            Local dump (.dump, .gz, .zst, and optional .age).
  --latest               Use the newest object under the configured prefix.
  --mode full|data       Restore mode (default: full).
  --force                Recreate the database (full) or truncate app tables (data).
  --yes                  Skip the interactive confirmation prompt.
  --migrate              After a successful restore, run go run ./cmd/migrate up
                         from backend/ (safe/idempotent when versions match).
  --allow-remote         Allow a non-localhost DATABASE_URL.
  --list                 List objects under the configured S3 prefix.
  -h, --help             Show this help.

Environment (names only; never commit values):
  DATABASE_URL           Target Postgres URL (backend/.env).
  S3_BACKUP_BUCKET       Source bucket (required for --s3-uri/--latest/--list).
  S3_BACKUP_PREFIX       Key prefix (default: postgres).
  S3_BACKUP_ENV          Environment segment (default: local).
  AWS_REGION             AWS region (or AWS_DEFAULT_REGION).
  AWS_PROFILE            Optional named profile.
  S3_ENDPOINT_URL        Optional S3-compatible endpoint (tests only).
  AGE_IDENTITY_FILE      age private key file when the artifact is .age.

Examples:
  scripts/db-restore-from-s3.sh --latest --force --yes
  scripts/db-restore-from-s3.sh --file var/db-backups/project_pn_dev.dump.gz --force --yes
  scripts/db-restore-from-s3.sh --s3-uri s3://project-pn-db-backups/postgres/local/2026/09/19/project_pn_dev-20260919T120000Z.dump.gz --mode data --force --yes --migrate
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/db-s3-common.sh
source "${SCRIPT_DIR}/lib/db-s3-common.sh"

REPO_ROOT="$(db_s3_repo_root)"
cd "$REPO_ROOT"
db_s3_load_backend_env "$REPO_ROOT"

S3_URI=""
LOCAL_FILE=""
USE_LATEST=false
MODE="full"
FORCE=false
YES=false
RUN_MIGRATE=false
ALLOW_REMOTE=false
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --s3-uri)
      [[ $# -ge 2 ]] || db_s3_die "--s3-uri requires an S3 URI"
      S3_URI="$2"
      shift 2
      ;;
    --file)
      [[ $# -ge 2 ]] || db_s3_die "--file requires a path"
      LOCAL_FILE="$2"
      shift 2
      ;;
    --latest)
      USE_LATEST=true
      shift
      ;;
    --mode)
      [[ $# -ge 2 ]] || db_s3_die "--mode requires full|data"
      MODE="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --yes)
      YES=true
      shift
      ;;
    --migrate)
      RUN_MIGRATE=true
      shift
      ;;
    --allow-remote)
      ALLOW_REMOTE=true
      shift
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      db_s3_die "unknown argument: $1 (use --help for usage)"
      ;;
  esac
done

if [[ "$LIST_ONLY" == "true" ]]; then
  db_s3_list
  exit 0
fi

case "$MODE" in
  full|data) ;;
  *) db_s3_die "--mode must be full or data" ;;
esac

sources=0
[[ -n "$S3_URI" ]] && sources=$((sources + 1))
[[ -n "$LOCAL_FILE" ]] && sources=$((sources + 1))
[[ "$USE_LATEST" == "true" ]] && sources=$((sources + 1))
[[ "$sources" -eq 1 ]] || db_s3_die "choose exactly one of --s3-uri, --file, or --latest"

db_s3_require_cmd python3
db_s3_require_cmd sha256sum
db_s3_require_cmd pg_restore
db_s3_require_database_url
db_s3_refuse_remote_unless_allowed "$ALLOW_REMOTE"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/project-pn-db-restore.XXXXXX")"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

artifact=""
if [[ -n "$LOCAL_FILE" ]]; then
  [[ -f "$LOCAL_FILE" ]] || db_s3_die "file not found: ${LOCAL_FILE}"
  artifact="$LOCAL_FILE"
  if [[ -f "${LOCAL_FILE}.sha256" ]]; then
    db_s3_verify_sha256 "$LOCAL_FILE" "${LOCAL_FILE}.sha256"
  else
    db_s3_log "no local ${LOCAL_FILE}.sha256 sidecar; skipping checksum"
  fi
else
  db_s3_require_cmd aws
  if [[ "$USE_LATEST" == "true" ]]; then
    latest_line="$(db_s3_list | awk '!/\.sha256$/ {print}' | tail -n 1)"
    [[ -n "$latest_line" ]] || db_s3_die "no dump objects found under $(db_s3_s3_prefix)/"
    key="$(awk '{print $4}' <<<"$latest_line")"
    S3_URI="s3://${S3_BACKUP_BUCKET}/${key}"
    db_s3_log "latest object: ${S3_URI}"
  fi
  [[ "$S3_URI" == s3://* ]] || db_s3_die "--s3-uri must start with s3://"
  artifact="${WORKDIR}/$(basename "$S3_URI")"
  db_s3_download "$S3_URI" "$artifact"
  if db_s3_aws s3 ls "${S3_URI}.sha256" >/dev/null 2>&1; then
    db_s3_download "${S3_URI}.sha256" "${artifact}.sha256"
    db_s3_verify_sha256 "$artifact" "${artifact}.sha256"
  else
    db_s3_log "no ${S3_URI}.sha256 sidecar; skipping checksum"
  fi
fi

payload="$artifact"
if [[ "$payload" == *.age ]]; then
  decrypted="${WORKDIR}/payload.decrypted"
  db_s3_log "decrypting age artifact"
  db_s3_age_decrypt "$payload" "$decrypted"
  payload="$decrypted"
fi

dump="${WORKDIR}/restore.dump"
case "$payload" in
  *.gz|*.zst)
    db_s3_log "decompressing $(basename "$payload")"
    db_s3_decompress "$payload" "$dump"
    ;;
  *)
    cp "$payload" "$dump"
    ;;
esac

target="$(db_s3_describe_target)"
db_s3_confirm "restore ${MODE} dump into ${target}?" "$YES"

if [[ "$MODE" == "full" ]]; then
  table_count="$(db_s3_public_table_count)"
  if [[ "$table_count" != "0" && "$FORCE" != "true" ]]; then
    db_s3_die "target already has ${table_count} public tables; pass --force to drop and recreate the database"
  fi
  if [[ "$FORCE" == "true" ]]; then
    db_s3_recreate_database
  fi
  db_s3_log "pg_restore --clean --if-exists (full)"
  pg_restore --no-owner --no-acl --clean --if-exists --exit-on-error --dbname="$DATABASE_URL" "$dump"
else
  if [[ "$FORCE" == "true" ]]; then
    db_s3_log "truncating application tables (keeping schema_migrations)"
    db_s3_truncate_app_tables
  fi
  toc="${WORKDIR}/restore.toc"
  pg_restore --list "$dump" | grep -v schema_migrations >"$toc" || true
  db_s3_log "pg_restore --data-only --disable-triggers (schema_migrations excluded)"
  pg_restore --no-owner --no-acl --data-only --disable-triggers \
    --exit-on-error \
    --use-list="$toc" \
    --dbname="$DATABASE_URL" "$dump"
fi

if [[ "$RUN_MIGRATE" == "true" ]]; then
  db_s3_require_cmd go
  db_s3_log "applying migrations (go run ./cmd/migrate up)"
  (
    cd "${REPO_ROOT}/backend"
    go run ./cmd/migrate up
  )
fi

db_s3_log "row counts after restore:"
db_s3_row_counts
db_s3_log "done"
