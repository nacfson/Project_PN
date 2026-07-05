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


-- 1. Mark the seeded dev user as email-verified.
update users
set email_verified_at = now()
where id = '00000000-0000-0000-0000-000000000001';

-- 2. Link the local dev guest identity under central authentication mapping.
insert into user_identities (user_id, provider, provider_subject, email_at_provider)
values (
    '00000000-0000-0000-0000-000000000001',
    'nacfson',
    '00000000-0000-0000-0000-000000000001',
    'dev@project-pn.local'
)
on conflict (provider, provider_subject) do nothing;
