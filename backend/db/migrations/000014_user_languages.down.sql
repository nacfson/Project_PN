alter table users drop column if exists ui_language;

drop index if exists user_languages_user_id_idx;
drop index if exists user_languages_active_unique;

drop table if exists user_languages;
