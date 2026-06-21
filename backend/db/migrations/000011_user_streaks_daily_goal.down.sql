drop index if exists user_streaks_user_id_idx;
drop table if exists user_streaks;

alter table review_settings
    drop constraint if exists review_settings_daily_goal_positive;

alter table review_settings
    drop column if exists daily_goal_xp;
