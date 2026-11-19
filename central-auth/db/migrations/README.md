# Central Auth Database Migrations

## Overview
Ordered `golang-migrate` PostgreSQL up/down SQL migrations defining the persistence schema for `central-auth`. The migration chain initializes user and session tables (with a conditional ProcessManager legacy table cutover), introduces OAuth identity linking and ephemeral state tracking, and removes the retired magic-link login artifacts so only Google OAuth identities remain permitted.

## Interface
- `[001_init.up.sql:pgcrypto]` — Enables the `pgcrypto` extension for UUID generation (`gen_random_uuid()`).
- `[001_init.up.sql:users]` — User accounts table (`id`, `email`, `is_admin`, `created_at`) with case-insensitive unique email constraint `users_email_lower_unique` and index `users_email_lower_unique_idx`.
- `[001_init.up.sql:magic_link_tokens]` — Legacy magic-link token table created in `001` and dropped in `[003_drop_magic_links.up.sql:magic_link_tokens]`.
- `[001_init.up.sql:sessions]` — Active/revoked session records (`id`, `user_id`, `access_token_hash`, `refresh_token_hash`, `cookie_value`, `access_expires_at`, `refresh_expires_at`, `login_at`, `revoked_at`, `created_at`), extended with `auth_provider` and `provider_subject` in `[002_oauth_identities.up.sql:sessions]`.
- `[002_oauth_identities.up.sql:user_identities]` — Provider-to-user identity mapping table (`id`, `user_id`, `provider`, `provider_subject`, `email_at_provider`, `linked_at`, `created_at`) with unique constraint `user_identities_provider_subject_unique` and partial unique index `user_identities_one_google_per_user`.
- `[002_oauth_identities.up.sql:oauth_states]` — Short-lived OAuth CSRF state table (`state_hash` PK, `redirect_url`, `expires_at`) indexed by `oauth_states_expires_at_idx`.
- `[003_drop_magic_links.up.sql:user_identities_provider_check]` — Replaces the provider check constraint on `user_identities` to allow only `provider = 'google'`, dropping `magic_link_tokens` and `user_identities_one_magic_per_user`.
- `[001_init.down.sql:sessions]`, `[002_oauth_identities.down.sql:user_identities]`, `[003_drop_magic_links.down.sql:magic_link_tokens]` — Rollback down-migration scripts reversing each corresponding up migration.

## Invariants
- `users.email` is unique case-insensitively via `users_email_lower_unique` (`unique (lower(email))`) and `users_email_lower_unique_idx` `[001_init.up.sql:users]`.
- `sessions.access_token_hash`, `sessions.refresh_token_hash`, and non-null `sessions.cookie_value` are unique; deleting a user cascades to `sessions` `[001_init.up.sql:sessions]`.
- `(provider, provider_subject)` in `user_identities` is globally unique, each user can link at most one `'google'` identity (`user_identities_one_google_per_user`), and deleting a user cascades to `user_identities` `[002_oauth_identities.up.sql:user_identities]`.
- After migration `003`, `user_identities.provider` is constrained exclusively to `'google'` `[003_drop_magic_links.up.sql:user_identities_provider_check]`.
- `oauth_states.state_hash` is a primary key preventing duplicate active state hashes `[002_oauth_identities.up.sql:oauth_states]`.

## Side Effects
- Creates the `pgcrypto` PostgreSQL extension if absent `[001_init.up.sql:pgcrypto]`.
- During ProcessManager cutover (when `public.login_tokens` exists and `public.magic_link_tokens` does not), renames `sessions` to `pm_sessions_legacy` and `login_tokens` to `pm_login_tokens_legacy` `[001_init.up.sql:pm_login_tokens_legacy]`.
- Revokes all non-revoked rows in `sessions` (`set revoked_at = now() where revoked_at is null`) when migration `002` runs to force re-login on deploy `[002_oauth_identities.up.sql:sessions]`.
- Executes destructive DDL (`drop table`, `drop index`, `alter table ... drop column/constraint`) in migration `003` and in the `*.down.sql` scripts `[003_drop_magic_links.up.sql:magic_link_tokens]`, `[001_init.down.sql:users]`, `[002_oauth_identities.down.sql:oauth_states]`, `[003_drop_magic_links.down.sql:magic_link_tokens]`.

## Verification
- Run: `cd central-auth && go test ./...`
