create table if not exists magic_link_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists magic_link_tokens_expires_at_idx on magic_link_tokens (expires_at);

create unique index if not exists user_identities_one_magic_per_user
    on user_identities (user_id) where provider = 'magic_link';

alter table user_identities
    drop constraint if exists user_identities_provider_check;

alter table user_identities
    add constraint user_identities_provider_check
    check (provider in ('google', 'magic_link'));
