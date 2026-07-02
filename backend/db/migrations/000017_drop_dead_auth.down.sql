-- Re-create dead local-auth tables and column for rollback.

alter table users add column if not exists password_hash text;

create table if not exists sessions (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint sessions_token_hash_unique unique (token_hash)
);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

create table if not exists email_verification_tokens (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint email_verification_tokens_token_hash_unique unique (token_hash)
);
create index if not exists email_verification_tokens_user_id_idx on email_verification_tokens (user_id);
create index if not exists email_verification_tokens_expires_at_idx on email_verification_tokens (expires_at);
