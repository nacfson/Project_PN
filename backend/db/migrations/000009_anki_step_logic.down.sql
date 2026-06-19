drop index if exists daily_review_counts_user_date_idx;
drop index if exists review_settings_user_id_idx;

alter table review_states
drop column if exists buried_until,
drop column if exists is_suspended;

drop table if exists daily_review_counts;
drop table if exists review_settings;
