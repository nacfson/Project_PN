create extension if not exists pgcrypto;

-- ProcessManager cutover: legacy auth tables use incompatible shapes. Rename before central-auth schema.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'login_tokens'
  ) and not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'magic_link_tokens'
  ) then
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'sessions'
    ) then
      alter table sessions rename to pm_sessions_legacy;
    end if;
    alter table login_tokens rename to pm_login_tokens_legacy;
  end if;
end $$;

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    is_admin boolean not null default false,
    created_at timestamptz not null default now(),
    constraint users_email_lower_unique unique (lower(email))
);

create unique index if not exists users_email_lower_unique_idx on users (lower(email));

create table if not exists magic_link_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists magic_link_tokens_expires_at_idx on magic_link_tokens (expires_at);

create table if not exists sessions (
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

create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_cookie_value_idx on sessions (cookie_value) where cookie_value is not null;
create index if not exists sessions_access_expires_at_idx on sessions (access_expires_at);
create index if not exists sessions_refresh_expires_at_idx on sessions (refresh_expires_at);
