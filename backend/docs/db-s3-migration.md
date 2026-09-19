# PostgreSQL Migration via AWS S3

One-shot copy of Project PN database **values** to another machine using AWS S3 as the courier.

Schema stays in git (`backend/db/migrations/`). S3 stores a `pg_dump` custom-format artifact, not a live database.

Scripts:

- `scripts/db-dump-to-s3.sh`
- `scripts/db-restore-from-s3.sh`
- `scripts/lib/db-s3-common.sh`

## Architecture

```text
source Postgres
  → pg_dump --format=custom --no-owner --no-acl
  → gzip (or zstd)
  → optional age encrypt
  → SHA-256 sidecar
  → aws s3 cp (SSE-S3 AES256 or SSE-KMS)
new PC
  → docker compose up
  → download + verify checksum
  → decrypt / decompress
  → pg_restore
  → optional migrate up if git is ahead of the dump
```

Two data classes travel together in one dump:

| Class | Tables | Why |
|---|---|---|
| Global dictionary | `words`, `word_senses`, `sense_translations`, `examples`, `example_translations` | Shared gloss cache. Re-fetching from WiktApi would lose history. |
| Personal memory | `users`, identities, `decks`, `user_word_senses`, `review_states`, `review_attempts`, settings, counts | The product. A word is global; memory is personal. |

Do not restore production into local `project_pn_dev` and then point a deployed backend at the laptop. Clone for development; do not reverse-sync local experiments to prod.

## Prerequisites

On both machines:

- PostgreSQL 16 client tools (`pg_dump`, `pg_restore`, `psql`) matching the server major version
- AWS CLI v2 (`aws configure` or `AWS_PROFILE`)
- `gzip` (default) or `zstd` if you pass `--compress zstd`
- `age` only when using `--encrypt`
- Docker Compose Postgres on the new PC (`backend/compose.yaml`, host port `5433`)

Create a **private** bucket before the first dump. Suggested name: `project-pn-db-backups` (must be globally unique on AWS).

Hard rules for that bucket:

- Block Public Access on
- Versioning on
- Default encryption SSE-S3 or SSE-KMS
- TLS-only bucket policy
- Lifecycle: expire or glacier after you no longer need the PC-move snapshot
- IAM user or SSO role with `s3:PutObject` / `s3:GetObject` / `s3:ListBucket` on that prefix only

This dump contains PII (emails, OAuth subjects, `personal_note`, review answers). Do not use a public bucket. Prefer `--encrypt` (`age`) in addition to bucket SSE.

## Environment

Variable **names** only. Put values in gitignored `backend/.env`, the AWS CLI profile, or Cursor environment secrets — never in git.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | from `backend/.env` | Source (dump) or target (restore) Postgres URL |
| `S3_BACKUP_BUCKET` | empty | Bucket name (required for upload / download / `--list`) |
| `S3_BACKUP_PREFIX` | `postgres` | Key prefix |
| `S3_BACKUP_ENV` | `local` | Environment segment (`local` or `prod`) |
| `AWS_REGION` | empty | Region (`AWS_DEFAULT_REGION` also works) |
| `AWS_PROFILE` | empty | Named AWS CLI profile |
| `S3_SSE` | `AES256` | `AES256`, `aws:kms`, or `none` |
| `S3_KMS_KEY_ID` | empty | Required when `S3_SSE=aws:kms` |
| `S3_ENDPOINT_URL` | empty | S3-compatible endpoint for tests only |
| `AGE_RECIPIENT` | empty | `age` recipient for `--encrypt` |
| `AGE_IDENTITY_FILE` | empty | `age` identity file for decrypt |

Object key:

```text
s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$S3_BACKUP_ENV/YYYY/MM/DD/<dbname>-<utc>.dump.gz
s3://$S3_BACKUP_BUCKET/$S3_BACKUP_PREFIX/$S3_BACKUP_ENV/YYYY/MM/DD/<dbname>-<utc>.dump.gz.sha256
```

`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are read by the AWS CLI if present. Do not add them to `.env.example`. Prefer `aws configure sso` or a named profile.

Scripts refuse a non-localhost `DATABASE_URL` unless you pass `--allow-remote`.

## Old machine (dump)

```sh
# optional: confirm the source
psql "$DATABASE_URL" -c "select count(*) from users; select count(*) from user_word_senses;"

S3_BACKUP_BUCKET=your-bucket \
S3_BACKUP_ENV=local \
AWS_REGION=ap-northeast-2 \
  scripts/db-dump-to-s3.sh --encrypt
```

Without client-side encrypt (bucket SSE only):

```sh
S3_BACKUP_BUCKET=your-bucket scripts/db-dump-to-s3.sh
```

Local artifact only (no AWS credentials; useful to test the dump):

```sh
scripts/db-dump-to-s3.sh --skip-upload
# writes var/db-backups/<db>.dump.gz and .sha256
```

Upload an existing dump (for example after `kubectl exec` on the Oracle postgres pod):

```sh
S3_BACKUP_BUCKET=your-bucket S3_BACKUP_ENV=prod \
  scripts/db-dump-to-s3.sh --upload-file /tmp/project_pn.dump --compress gzip
```

Do not expose the production Postgres port on the public internet just to copy it.

## New PC (restore)

1. Clone the repo and copy `backend/.env.example` → `backend/.env`.
2. Start an **empty** Postgres 16 volume:

```sh
cd backend
docker compose --env-file .env up -d
```

3. Restore. Default `--mode full` expects no public tables, or `--force` to drop and recreate the database:

```sh
S3_BACKUP_BUCKET=your-bucket \
S3_BACKUP_ENV=local \
AWS_REGION=ap-northeast-2 \
  scripts/db-restore-from-s3.sh --latest --force --yes --migrate
```

`--migrate` runs `go run ./cmd/migrate up` after restore so a newer git tree can apply migrations the dump does not contain. If dump and git are the same version, migrate is a no-op.

From a local file instead of S3:

```sh
scripts/db-restore-from-s3.sh \
  --file var/db-backups/project_pn_dev.dump.gz \
  --force --yes --migrate
```

`--mode data` is for a database that already has migrations applied: it keeps `schema_migrations`, truncates the other public tables when `--force`, and restores data only.

4. Confirm:

```sh
cd backend && set -a && source .env && set +a
go run ./cmd/migrate version
curl -fsS http://localhost:8080/readyz   # after starting the API
```

The restore script prints counts for `users`, `words`, `word_senses`, `user_word_senses`, `review_states`, `review_attempts`, and `decks`. Those should match the source.

## Modes

| Restore mode | When to use |
|---|---|
| `full` (default) | PC-to-PC move. Dump includes schema + `schema_migrations`. Do **not** run `migrate up` on an empty DB *before* this restore. |
| `data` | Target already migrated from git. Use `--force` so app tables are truncated first. `schema_migrations` is excluded from the restore. |

Do not mix `migrate up` on an empty database **and** a full schema dump. That double-applies DDL or fights `schema_migrations`.

## Production source (optional)

If the source is the Oracle k3s StatefulSet, dump inside the cluster network, then upload the file:

```sh
sudo env KUBECONFIG=/secure/production.conf kubectl -n project-pn \
  exec deploy/postgres -- \
  pg_dump --format=custom --no-owner --no-acl -U project_pn project_pn \
  > /tmp/project_pn.dump

S3_BACKUP_BUCKET=your-bucket S3_BACKUP_ENV=prod \
  scripts/db-dump-to-s3.sh --upload-file /tmp/project_pn.dump
```

Pod and database names may differ; read them from the live cluster, not this file. Use `--allow-remote` only if `DATABASE_URL` points at a tunneled host, not the public internet.

A recurring k3s CronJob (or WAL-G / pgBackRest) is the production backup architecture. These scripts are the PC-move consumer of the same bucket layout (`postgres/prod/`). They are not a substitute for tested production backups.

## What not to do

- Copy `/var/lib/postgresql/data` out of the Docker volume `project_pn_postgres_data`
- Commit dump files, checksums, or AWS keys
- Use a public bucket or `S3_SSE=none` on real AWS
- Restore prod into local and write back
- Stand up WAL-G only to move one laptop
