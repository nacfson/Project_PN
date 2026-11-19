# Scripts Library (`scripts/lib`)

## Overview
Contains shared Bash utility libraries sourced by operational database backup and restore scripts under `scripts/`.

## Interface
- Logging & environment discovery: `db_s3_log`, `db_s3_die`, `db_s3_require_cmd`, `db_s3_repo_root`, `db_s3_load_backend_env` `[db-s3-common.sh:db_s3_load_backend_env]`
- `DATABASE_URL` parsing & safety guards: `db_s3_url_field` (`scheme`, `user`, `host`, `port`, `dbname`, `admin_url`, `is_local`), `db_s3_require_database_url`, `db_s3_refuse_remote_unless_allowed`, `db_s3_describe_target`, `db_s3_confirm`, `db_s3_require_ident` `[db-s3-common.sh:db_s3_url_field]` `[db-s3-common.sh:db_s3_refuse_remote_unless_allowed]`
- S3 object helpers: `db_s3_s3_prefix`, `db_s3_dated_key`, `db_s3_aws`, `db_s3_sse_args`, `db_s3_upload`, `db_s3_download`, `db_s3_list` `[db-s3-common.sh:db_s3_upload]` `[db-s3-common.sh:db_s3_download]`
- Checksum, compression & encryption helpers: `db_s3_sha256_file`, `db_s3_write_sha256`, `db_s3_verify_sha256`, `db_s3_compress` (`gzip`|`zstd`|`none`), `db_s3_decompress`, `db_s3_age_encrypt`, `db_s3_age_decrypt` `[db-s3-common.sh:db_s3_compress]` `[db-s3-common.sh:db_s3_age_encrypt]`
- PostgreSQL helpers: `db_s3_psql`, `db_s3_public_table_count`, `db_s3_truncate_app_tables`, `db_s3_row_counts`, `db_s3_recreate_database` `[db-s3-common.sh:db_s3_truncate_app_tables]` `[db-s3-common.sh:db_s3_recreate_database]`

## Invariants
- Refuses direct execution (`BASH_SOURCE[0] == $0` exits 1); intended exclusively to be sourced `[db-s3-common.sh:top-level]`
- `db_s3_load_backend_env` preserves caller-supplied environment overrides for `DATABASE_URL`, `S3_BACKUP_*`, `AWS_*`, `S3_SSE`, `S3_KMS_KEY_ID`, `S3_ENDPOINT_URL`, and `AGE_*` when sourcing `backend/.env` or `backend/.env.example` `[db-s3-common.sh:db_s3_load_backend_env]`
- `db_s3_refuse_remote_unless_allowed` aborts unless `DATABASE_URL` targets a local host (`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`) or `allow_remote=true` `[db-s3-common.sh:db_s3_refuse_remote_unless_allowed]`
- `db_s3_confirm` aborts non-interactive stdin unless `yes=true` `[db-s3-common.sh:db_s3_confirm]`
- `db_s3_sse_args` defaults to `AES256`, requires `S3_KMS_KEY_ID` for `aws:kms`/`KMS`, and fails on unsupported values `[db-s3-common.sh:db_s3_sse_args]`
- `db_s3_require_ident` restricts SQL identifiers to `^[A-Za-z_][A-Za-z0-9_]*$`, and `db_s3_recreate_database` refuses to drop the `postgres` maintenance database `[db-s3-common.sh:db_s3_require_ident]` `[db-s3-common.sh:db_s3_recreate_database]`
- `db_s3_truncate_app_tables` truncates all `public` tables except `schema_migrations` `[db-s3-common.sh:db_s3_truncate_app_tables]`

## Side Effects
- Sources `backend/.env` (or `backend/.env.example`) into the active shell environment `[db-s3-common.sh:db_s3_load_backend_env]`
- Invokes external CLIs: `git`, `python3`, `aws`, `sha256sum`, `gzip`, `zstd`, `age`, and `psql` `[db-s3-common.sh:db_s3_url_field]` `[db-s3-common.sh:db_s3_aws]` `[db-s3-common.sh:db_s3_psql]`
- Writes `.sha256` sidecars, compresses/decompresses or encrypts/decrypts files on disk (removing input on `gzip`/`zstd --rm`), and uploads/downloads S3 objects `[db-s3-common.sh:db_s3_write_sha256]` `[db-s3-common.sh:db_s3_compress]` `[db-s3-common.sh:db_s3_upload]`
- Executes destructive PostgreSQL statements (`TRUNCATE ... RESTART IDENTITY CASCADE`, `pg_terminate_backend`, `DROP DATABASE`, `CREATE DATABASE`) `[db-s3-common.sh:db_s3_truncate_app_tables]` `[db-s3-common.sh:db_s3_recreate_database]`

## Verification
- Run: `npm run lint && npm run verify`
