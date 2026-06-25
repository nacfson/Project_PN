drop table if exists email_verification_tokens;

-- Recreate OAuth/magic-link tables exactly as they were in 000003_auth.up.sql

create table user_identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    provider_subject text not null,
    email_at_provider text,
    created_at timestamptz not null default now(),
    constraint user_identities_provider_subject_unique unique (provider, provider_subject)
);
create index user_identities_user_id_idx on user_identities (user_id);

create table magic_link_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint magic_link_tokens_token_hash_unique unique (token_hash)
);
create index magic_link_tokens_user_id_idx on magic_link_tokens (user_id);
create index magic_link_tokens_expires_at_idx on magic_link_tokens (expires_at);

create table magic_login_exchanges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    code_hash text not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint magic_login_exchanges_code_hash_unique unique (code_hash)
);
create index magic_login_exchanges_user_id_idx on magic_login_exchanges (user_id);
create index magic_login_exchanges_expires_at_idx on magic_login_exchanges (expires_at);
