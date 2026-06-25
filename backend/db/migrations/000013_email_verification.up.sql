-- 1. Token table for email verification links

create table email_verification_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    token_hash text not null,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint email_verification_tokens_token_hash_unique unique (token_hash)
);
create index email_verification_tokens_user_id_idx on email_verification_tokens (user_id);
create index email_verification_tokens_expires_at_idx on email_verification_tokens (expires_at);

-- 2. Remove OAuth and magic-link tables now that those auth methods are removed

drop table if exists magic_login_exchanges;
drop table if exists magic_link_tokens;
drop table if exists user_identities;
