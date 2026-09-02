alter table user_identities
    add column if not exists linked_at timestamptz not null default now();

create unique index if not exists user_identities_one_google_per_user
    on user_identities (user_id) where provider = 'google';
create unique index if not exists user_identities_one_nacfson_per_user
    on user_identities (user_id) where provider = 'nacfson';

create table if not exists account_merge_requests (
    id uuid primary key default gen_random_uuid(),
    source_user_id uuid not null references users(id) on delete cascade,
    target_user_id uuid not null references users(id) on delete cascade,
    initiated_by_user_id uuid not null references users(id),
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'cancelled')),
    source_email text not null,
    target_email text not null,
    expires_at timestamptz not null,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    constraint account_merge_requests_distinct_users
        check (source_user_id <> target_user_id)
);

create index if not exists account_merge_requests_target_status_idx
    on account_merge_requests (target_user_id, status);
