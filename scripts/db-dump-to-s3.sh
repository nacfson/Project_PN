#!/usr/bin/env bash
set -euo pipefail

# Dump Project PN PostgreSQL to a custom-format artifact and upload it to AWS S3.
# Schema source of truth stays in backend/db/migrations/; this artifact carries values.

usage() {
  cat <<'USAGE'
Usage:
  scripts/db-dump-to-s3.sh [options]
  scripts/db-dump-to-s3.sh --list
  scripts/db-dump-to-s3.sh --upload-file PATH

Dump the database in DATABASE_URL (custom format, no owner/ACL), compress it,
write a SHA-256 sidecar, optionally encrypt with age, and upload both objects
to AWS S3.

Object key:
  s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$S3_BACKUP_ENV/YYYY/MM/DD/<db>-<utc>.dump.gz

Options:
  --skip-upload          Write the local artifact only (no AWS credentials needed).
  --keep-local DIR       Keep a copy under DIR (default: var/db-backups when --skip-upload).
  --upload-file PATH     Upload an existing pg_dump custom-format file (or .gz/.zst/.age).
  --compress gzip|zstd|none
                         Compression codec (default: gzip).
  --encrypt              Encrypt with age using AGE_RECIPIENT.
  --allow-remote         Allow a non-localhost DATABASE_URL (e.g. tunneled prod).
  --list                 List objects under the configured S3 prefix.
  -h, --help             Show this help.

Environment (names only; never commit values):
  DATABASE_URL           Postgres URL (backend/.env).
  S3_BACKUP_BUCKET       Target bucket (required unless --skip-upload).
  S3_BACKUP_PREFIX       Key prefix (default: postgres).
  S3_BACKUP_ENV          Environment segment (default: local).
  AWS_REGION             AWS region (or AWS_DEFAULT_REGION).
  AWS_PROFILE            Optional named profile.
  S3_SSE                 AES256 (default), aws:kms, or none.
  S3_KMS_KEY_ID          Required when S3_SSE=aws:kms.
  S3_ENDPOINT_URL        Optional S3-compatible endpoint (tests only).
  AGE_RECIPIENT          age recipient (public key or email) when --encrypt.

Examples:
  S3_BACKUP_BUCKET=project-pn-db-backups scripts/db-dump-to-s3.sh
  scripts/db-dump-to-s3.sh --skip-upload
  scripts/db-dump-to-s3.sh --upload-file /tmp/prod.dump --compress gzip
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/db-s3-common.sh
source "${SCRIPT_DIR}/lib/db-s3-common.sh"

REPO_ROOT="$(db_s3_repo_root)"
cd "$REPO_ROOT"
db_s3_load_backend_env "$REPO_ROOT"

SKIP_UPLOAD=false
KEEP_LOCAL=""
UPLOAD_FILE=""
COMPRESS="gzip"
ENCRYPT=false
ALLOW_REMOTE=false
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-upload)
      SKIP_UPLOAD=true
      shift
      ;;
    --keep-local)
      [[ $# -ge 2 ]] || db_s3_die "--keep-local requires a directory"
      KEEP_LOCAL="$2"
      shift 2
      ;;
    --upload-file)
      [[ $# -ge 2 ]] || db_s3_die "--upload-file requires a path"
      UPLOAD_FILE="$2"
      shift 2
      ;;
    --compress)
      [[ $# -ge 2 ]] || db_s3_die "--compress requires gzip|zstd|none"
      COMPRESS="$2"
      shift 2
      ;;
    --encrypt)
      ENCRYPT=true
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

db_s3_require_cmd python3
db_s3_require_cmd sha256sum

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/project-pn-db-dump.XXXXXX")"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

if [[ -n "$UPLOAD_FILE" ]]; then
  [[ -f "$UPLOAD_FILE" ]] || db_s3_die "upload file not found: ${UPLOAD_FILE}"
  artifact="$UPLOAD_FILE"
  db_s3_log "using existing file $(basename "$artifact")"
else
  db_s3_require_cmd pg_dump
  db_s3_require_database_url
  db_s3_refuse_remote_unless_allowed "$ALLOW_REMOTE"
  dbname="$(db_s3_url_field dbname)"
  db_s3_log "dumping $(db_s3_describe_target) (custom format, no owner/ACL)"
  raw="${WORKDIR}/${dbname}.dump"
  pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$raw"
  artifact="$(db_s3_compress "$raw" "$COMPRESS")"
fi

if [[ "$ENCRYPT" == "true" ]]; then
  artifact="$(db_s3_age_encrypt "$artifact")"
fi

db_s3_write_sha256 "$artifact"

if [[ "$SKIP_UPLOAD" == "true" && -z "$KEEP_LOCAL" ]]; then
  KEEP_LOCAL="${REPO_ROOT}/var/db-backups"
fi

if [[ -n "$KEEP_LOCAL" ]]; then
  mkdir -p "$KEEP_LOCAL"
  kept="${KEEP_LOCAL}/$(basename "$artifact")"
  cp "$artifact" "$kept"
  cp "${artifact}.sha256" "${kept}.sha256"
  db_s3_log "local artifact: ${kept}"
  db_s3_log "checksum: ${kept}.sha256"
fi

if [[ "$SKIP_UPLOAD" == "true" ]]; then
  db_s3_log "skipping S3 upload"
  exit 0
fi

stem="$(db_s3_url_field dbname 2>/dev/null || true)"
if [[ -z "$stem" ]]; then
  stem="project_pn"
fi
base="$(db_s3_dated_key "$stem")"
ext=""
case "$artifact" in
  *.dump.zst.age) ext=".dump.zst.age" ;;
  *.dump.gz.age) ext=".dump.gz.age" ;;
  *.dump.age) ext=".dump.age" ;;
  *.dump.zst) ext=".dump.zst" ;;
  *.dump.gz) ext=".dump.gz" ;;
  *.dump) ext=".dump" ;;
  *) ext=".$(basename "$artifact" | sed 's/^[^.]*\.//')" ;;
esac
uri="${base}${ext}"

db_s3_upload "$artifact" "$uri"
db_s3_upload "${artifact}.sha256" "${uri}.sha256"
db_s3_log "uploaded ${uri}"
db_s3_log "uploaded ${uri}.sha256"
