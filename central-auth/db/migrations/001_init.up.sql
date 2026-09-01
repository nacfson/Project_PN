create extension if not exists pgcrypto;

create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    is_admin boolean not null default false,
    created_at timestamptz not null default now(),
    constraint users_email_lower_unique unique (lower(email))
);

create table magic_link_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

create index magic_link_tokens_expires_at_idx on magic_link_tokens (expires_at);

create table sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    access_token_hash text not null unique,
    refresh_token_hash text not null unique,
    cookie_value text unique,
    access_expires_at timestamptz not null,
    refresh_expires_at timestamptz not null,
    login_at timestamptz not null default now(),
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions (user_id);
create index sessions_cookie_value_idx on sessions (cookie_value) where cookie_value is not null;
create index sessions_access_expires_at_idx on sessions (access_expires_at);
create index sessions_refresh_expires_at_idx on sessions (refresh_expires_at);
