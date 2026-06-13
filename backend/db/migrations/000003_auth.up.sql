-- 1. Add columns
alter table users add column password_hash text;
alter table users add column email_verified_at timestamptz;

-- 2. Replace case-sensitive unique (000001 line 5: email text not null unique)
alter table users drop constraint users_email_key;
create unique index users_email_lower_idx on users (lower(email));

create table sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint sessions_token_hash_unique unique (token_hash)
);
create index sessions_user_id_idx on sessions (user_id);
create index sessions_expires_at_idx on sessions (expires_at);

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
