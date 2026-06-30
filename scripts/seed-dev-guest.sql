-- Local dev-only guest seed.
-- This file is intentionally NOT a migration; it is applied by scripts/start-web-dev.sh
-- and scripts/seed-dev-guest.sh only. It must never run in production or staging.
--
-- It promotes the seeded dev user (migration 000002) to a verified account and
-- creates a long-lived session for the plain token "local-dev-guest".
--
-- GUARD: This file must only be invoked through scripts/seed-dev-guest.sh, which
-- refuses to run unless PN_ENV=local or APP_ENV=local. The psql guard below exits
-- if the caller did not set IS_LOCAL=1.

-- GUARD: require IS_LOCAL=1. Use a deliberate SQL error so psql exits non-zero
-- on failure; psql's \q does not accept an exit-code argument.
\if :{?IS_LOCAL}
  \if :IS_LOCAL
  \else
    \echo 'FATAL: seed-dev-guest.sql can only run in local dev. Invoke via scripts/seed-dev-guest.sh.'
    \set ON_ERROR_STOP 1
    DO $$ BEGIN RAISE EXCEPTION 'seed-dev-guest.sql guard failed: IS_LOCAL must be 1'; END $$;
  \endif
\else
  \echo 'FATAL: seed-dev-guest.sql can only run in local dev. Invoke via scripts/seed-dev-guest.sh.'
  \set ON_ERROR_STOP 1
  DO $$ BEGIN RAISE EXCEPTION 'seed-dev-guest.sql guard failed: IS_LOCAL not set'; END $$;
\endif

-- Plain token: local-dev-guest
-- Hash = lower(hex(sha256('local-dev-guest')))
\set token_hash '3d0d4e8359b96a65bf38b50287b0d9df6ecdfd757d1211ae8b354cbc3f910b9c'

-- 1. Mark the seeded dev user as email-verified.
update users
set email_verified_at = now()
where id = '00000000-0000-0000-0000-000000000001';

-- 2. Create or refresh a long-lived guest session.
insert into sessions (user_id, token_hash, expires_at)
values (
    '00000000-0000-0000-0000-000000000001',
    :'token_hash',
    now() + interval '30 days'
)
on conflict (token_hash) do update set expires_at = excluded.expires_at;

-- 3. Clean up expired sessions for the guest user to keep the table tidy.
delete from sessions
where user_id = '00000000-0000-0000-0000-000000000001'
  and expires_at < now()
  and token_hash <> :'token_hash';
