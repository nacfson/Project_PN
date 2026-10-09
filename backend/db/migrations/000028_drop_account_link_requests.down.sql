create table if not exists account_link_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    initiated_by_user_id uuid not null references users(id),
    pending_provider text not null,
    pending_provider_subject text not null,
    pending_email text not null,
    status text not null default 'pending'
        check (status in ('pending', 'completed', 'cancelled', 'expired')),
    approval_method text,
    magic_link_sent_at timestamptz,
    expires_at timestamptz not null,
    completed_at timestamptz,
    cancelled_at timestamptz,
    created_at timestamptz not null default now()
);

create unique index if not exists account_link_requests_one_pending
    on account_link_requests (user_id, pending_provider)
    where status = 'pending';

create index if not exists account_link_requests_user_status_idx
    on account_link_requests (user_id, status);

create unique index if not exists user_identities_one_nacfson_per_user
    on user_identities (user_id) where provider = 'nacfson';
