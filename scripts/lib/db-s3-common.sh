#!/usr/bin/env bash
# Shared helpers for scripts/db-dump-to-s3.sh and scripts/db-restore-from-s3.sh.
# Sourced only; do not execute directly.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  printf 'db-s3-common.sh is a library; source it from the dump/restore scripts.\n' >&2
  exit 1
fi

db_s3_log() {
  printf '[db-s3] %s\n' "$*"
}

db_s3_die() {
  printf '[db-s3] ERROR: %s\n' "$*" >&2
  exit 1
}

db_s3_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || db_s3_die "missing required command: $1"
}

db_s3_repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || db_s3_die "must be run from inside the Project PN git repo"
}

db_s3_load_backend_env() {
  local root="$1"
  if [[ -f "${root}/backend/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${root}/backend/.env"
    set +a
  elif [[ -f "${root}/backend/.env.example" ]]; then
    db_s3_log "backend/.env not found; loading backend/.env.example for DATABASE_URL defaults"
    set -a
    # shellcheck source=/dev/null
    source "${root}/backend/.env.example"
    set +a
  fi
}

# Parse DATABASE_URL without printing it. Usage: db_s3_url_field <field>
# Fields: scheme, user, host, port, dbname, admin_url, is_local
db_s3_url_field() {
  local field="$1"
  _PN_DATABASE_URL="${DATABASE_URL:-}" python3 - "$field" <<'PY'
import os, sys
from urllib.parse import urlparse, urlunparse

field = sys.argv[1]
raw = os.environ.get("_PN_DATABASE_URL", "")
if not raw:
    sys.exit(2)
u = urlparse(raw)
dbname = u.path.lstrip("/").split("/")[0]
host = u.hostname or ""
port = str(u.port or "")
user = u.username or ""
is_local = host in {"localhost", "127.0.0.1", "::1", "host.docker.internal"}
if field == "scheme":
    print(u.scheme)
elif field == "user":
    print(user)
elif field == "host":
    print(host)
elif field == "port":
    print(port)
elif field == "dbname":
    print(dbname)
elif field == "is_local":
    print("true" if is_local else "false")
elif field == "admin_url":
    path = "/postgres"
    if u.query:
        print(urlunparse((u.scheme, u.netloc, path, "", u.query, "")))
    else:
        print(urlunparse((u.scheme, u.netloc, path, "", "", "")))
else:
    sys.exit(3)
PY
}

db_s3_require_database_url() {
  [[ -n "${DATABASE_URL:-}" ]] || db_s3_die "DATABASE_URL is not set (copy backend/.env.example → backend/.env)"
  db_s3_url_field dbname >/dev/null || db_s3_die "DATABASE_URL is not a valid postgres URL"
}

db_s3_refuse_remote_unless_allowed() {
  local allow_remote="$1"
  local is_local
  is_local="$(db_s3_url_field is_local)"
  if [[ "$is_local" != "true" && "$allow_remote" != "true" ]]; then
    db_s3_die "DATABASE_URL host is not local; pass --allow-remote to dump or restore a remote database"
  fi
}

db_s3_describe_target() {
  local host port dbname user
  host="$(db_s3_url_field host)"
  port="$(db_s3_url_field port)"
  dbname="$(db_s3_url_field dbname)"
  user="$(db_s3_url_field user)"
  printf '%s@%s:%s/%s' "$user" "$host" "$port" "$dbname"
}

db_s3_confirm() {
  local prompt="$1"
  local yes="$2"
  if [[ "$yes" == "true" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    db_s3_die "refusing non-interactive restore without --yes"
  fi
  local reply=""
  read -r -p "[db-s3] ${prompt} [y/N] " reply
  [[ "$reply" == "y" || "$reply" == "Y" ]] || db_s3_die "aborted"
}

db_s3_s3_prefix() {
  local bucket="${S3_BACKUP_BUCKET:-}"
  local prefix="${S3_BACKUP_PREFIX:-postgres}"
  local env_name="${S3_BACKUP_ENV:-local}"
  [[ -n "$bucket" ]] || db_s3_die "S3_BACKUP_BUCKET is not set"
  prefix="${prefix#/}"
  prefix="${prefix%/}"
  env_name="${env_name#/}"
  env_name="${env_name%/}"
  printf 's3://%s/%s/%s' "$bucket" "$prefix" "$env_name"
}

db_s3_dated_key() {
  local stem="$1"
  local stamp
  stamp="$(date -u +%Y/%m/%d)/${stem}-$(date -u +%Y%m%dT%H%M%SZ)"
  printf '%s/%s' "$(db_s3_s3_prefix)" "$stamp"
}

db_s3_aws() {
  local -a extra=()
  local region="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
  local endpoint="${S3_ENDPOINT_URL:-${AWS_ENDPOINT_URL:-}}"
  [[ -n "$region" ]] && extra+=(--region "$region")
  [[ -n "$endpoint" ]] && extra+=(--endpoint-url "$endpoint")
  aws "${extra[@]}" "$@"
}

db_s3_sse_args() {
  local sse="${S3_SSE:-AES256}"
  case "$sse" in
    AES256)
      printf '%s\n' --sse AES256
      ;;
    aws:kms|KMS)
      [[ -n "${S3_KMS_KEY_ID:-}" ]] || db_s3_die "S3_SSE=aws:kms requires S3_KMS_KEY_ID"
      printf '%s\n' --sse aws:kms --sse-kms-key-id "${S3_KMS_KEY_ID}"
      ;;
    none|NONE|"")
      ;;
    *)
      db_s3_die "S3_SSE must be AES256, aws:kms, or none (got ${sse})"
      ;;
  esac
}

db_s3_upload() {
  local file="$1"
  local uri="$2"
  db_s3_require_cmd aws
  local -a sse=()
  local line
  while IFS= read -r line; do
    [[ -n "$line" ]] && sse+=("$line")
  done < <(db_s3_sse_args)
  db_s3_log "uploading $(basename "$file") → ${uri}"
  db_s3_aws s3 cp "$file" "$uri" "${sse[@]}"
}

db_s3_download() {
  local uri="$1"
  local dest="$2"
  db_s3_require_cmd aws
  db_s3_log "downloading ${uri}"
  db_s3_aws s3 cp "$uri" "$dest"
}

db_s3_list() {
  db_s3_require_cmd aws
  db_s3_aws s3 ls "$(db_s3_s3_prefix)/" --recursive
}

db_s3_sha256_file() {
  local file="$1"
  sha256sum "$file" | awk '{print $1}'
}

db_s3_write_sha256() {
  local file="$1"
  db_s3_sha256_file "$file" >"${file}.sha256"
}

db_s3_verify_sha256() {
  local file="$1"
  local sidecar="$2"
  [[ -f "$sidecar" ]] || db_s3_die "checksum sidecar missing: ${sidecar}"
  local expected actual
  expected="$(awk '{print $1}' "$sidecar")"
  actual="$(db_s3_sha256_file "$file")"
  [[ "$expected" == "$actual" ]] || db_s3_die "SHA-256 mismatch for $(basename "$file")"
  db_s3_log "SHA-256 verified"
}

db_s3_compress() {
  local src="$1"
  local codec="${2:-gzip}"
  case "$codec" in
    gzip)
      db_s3_require_cmd gzip
      gzip -n -9 "$src"
      printf '%s.gz\n' "$src"
      ;;
    zstd)
      db_s3_require_cmd zstd
      zstd -q -19 --rm "$src"
      printf '%s.zst\n' "$src"
      ;;
    none)
      printf '%s\n' "$src"
      ;;
    *)
      db_s3_die "unsupported --compress value: ${codec} (gzip|zstd|none)"
      ;;
  esac
}

db_s3_decompress() {
  local src="$1"
  local dest="$2"
  case "$src" in
    *.gz)
      db_s3_require_cmd gzip
      gzip -dc "$src" >"$dest"
      ;;
    *.zst)
      db_s3_require_cmd zstd
      zstd -dc "$src" >"$dest"
      ;;
    *)
      cp "$src" "$dest"
      ;;
  esac
}

db_s3_age_encrypt() {
  local src="$1"
  local recipient="${AGE_RECIPIENT:-}"
  [[ -n "$recipient" ]] || db_s3_die "AGE_RECIPIENT is required for --encrypt"
  db_s3_require_cmd age
  age -r "$recipient" -o "${src}.age" "$src"
  printf '%s.age\n' "$src"
}

db_s3_age_decrypt() {
  local src="$1"
  local dest="$2"
  db_s3_require_cmd age
  local -a ident=()
  if [[ -n "${AGE_IDENTITY_FILE:-}" ]]; then
    ident+=(-i "${AGE_IDENTITY_FILE}")
  fi
  age -d "${ident[@]}" -o "$dest" "$src"
}

db_s3_psql() {
  db_s3_require_cmd psql
  psql --no-psqlrc -v ON_ERROR_STOP=1 -X "$@"
}

db_s3_public_table_count() {
  db_s3_psql "$DATABASE_URL" -t -A -c \
    "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'"
}

db_s3_truncate_app_tables() {
  db_s3_psql "$DATABASE_URL" <<'SQL'
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in ('schema_migrations')
  loop
    execute format('truncate table %I.%I restart identity cascade', 'public', r.tablename);
  end loop;
end $$;
SQL
}

db_s3_row_counts() {
  db_s3_psql "$DATABASE_URL" -c "
    select * from (
      select 'users' as table_name, count(*)::bigint as n from users
      union all select 'words', count(*) from words
      union all select 'word_senses', count(*) from word_senses
      union all select 'user_word_senses', count(*) from user_word_senses
      union all select 'review_states', count(*) from review_states
      union all select 'review_attempts', count(*) from review_attempts
      union all select 'decks', count(*) from decks
    ) t
    order by table_name;
  "
}

db_s3_require_ident() {
  local value="$1"
  local label="$2"
  [[ "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || db_s3_die "refusing unsafe ${label} identifier: ${value}"
}

db_s3_recreate_database() {
  local dbname admin_url user
  dbname="$(db_s3_url_field dbname)"
  admin_url="$(db_s3_url_field admin_url)"
  user="$(db_s3_url_field user)"
  db_s3_require_ident "$dbname" "database"
  db_s3_require_ident "$user" "owner"
  [[ "$dbname" != "postgres" ]] || db_s3_die "refusing to drop the postgres maintenance database"
  db_s3_log "recreating database ${dbname}"
  db_s3_psql "$admin_url" <<SQL
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = '${dbname}'
  and pid <> pg_backend_pid();
drop database if exists ${dbname};
create database ${dbname} owner ${user};
SQL
}
