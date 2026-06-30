create table if not exists user_identities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    provider_subject text not null,
    email_at_provider text,
    created_at timestamptz not null default now(),
    constraint user_identities_provider_subject_unique unique (provider, provider_subject)
);

create index if not exists user_identities_user_id_idx on user_identities (user_id);
