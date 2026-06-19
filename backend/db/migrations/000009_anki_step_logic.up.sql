-- Per-user review configuration (Anki deck-level equivalent).
create table review_settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    new_cards_per_day integer not null default 20,
    reviews_per_day integer not null default 200,
    learning_steps integer[] not null default '{1,10}',      -- minutes
    relearning_steps integer[] not null default '{10}',       -- minutes
    leech_threshold integer not null default 8,
    leech_action text not null default 'suspend',
    fuzz_enabled boolean not null default true,
    desired_retention double precision not null default 0.90,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint review_settings_user_unique unique (user_id),
    constraint review_settings_leech_action_valid check (leech_action in ('suspend', 'tag')),
    constraint review_settings_desired_retention_valid check (desired_retention between 0.7 and 0.99),
    constraint review_settings_new_cards_positive check (new_cards_per_day >= 0),
    constraint review_settings_reviews_positive check (reviews_per_day >= 0),
    constraint review_settings_leech_threshold_positive check (leech_threshold >= 1)
);

-- Track daily review counts for quota enforcement.
create table daily_review_counts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    review_date date not null,
    new_cards_done integer not null default 0,
    reviews_done integer not null default 0,
    constraint daily_review_counts_user_date_unique unique (user_id, review_date)
);

-- Bury and suspend tracking on review_states.
alter table review_states
add column buried_until timestamptz,
add column is_suspended boolean not null default false;

create index review_settings_user_id_idx on review_settings (user_id);
create index daily_review_counts_user_date_idx on daily_review_counts (user_id, review_date);
