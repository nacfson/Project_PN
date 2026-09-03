create table if not exists user_identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    provider text not null check (provider in ('google', 'magic_link')),
    provider_subject text not null,
    email_at_provider text,
    linked_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint user_identities_provider_subject_unique unique (provider, provider_subject)
);

create index user_identities_user_id_idx on user_identities (user_id);
create unique index user_identities_one_google_per_user
    on user_identities (user_id) where provider = 'google';
create unique index user_identities_one_magic_per_user
    on user_identities (user_id) where provider = 'magic_link';

create table if not exists oauth_states (
    state_hash text primary key,
    redirect_url text not null,
    expires_at timestamptz not null
);

create index oauth_states_expires_at_idx on oauth_states (expires_at);

alter table sessions
    add column if not exists auth_provider text,
    add column if not exists provider_subject text;

-- Force re-login on deploy: revoke all active sessions.
update sessions set revoked_at = now() where revoked_at is null;
