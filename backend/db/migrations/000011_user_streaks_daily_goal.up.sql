alter table review_settings
    add column daily_goal_xp integer not null default 200;

alter table review_settings
    add constraint review_settings_daily_goal_positive check (daily_goal_xp >= 10);

create table user_streaks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    current_streak_days integer not null default 0,
    longest_streak_days integer not null default 0,
    last_review_date date,
    streak_freeze_tokens integer not null default 1,
    vacation_mode_until date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_streaks_user_unique unique (user_id),
    constraint user_streaks_current_non_negative check (current_streak_days >= 0),
    constraint user_streaks_longest_non_negative check (longest_streak_days >= 0),
    constraint user_streaks_freeze_non_negative check (streak_freeze_tokens >= 0)
);

create index user_streaks_user_id_idx on user_streaks (user_id);
