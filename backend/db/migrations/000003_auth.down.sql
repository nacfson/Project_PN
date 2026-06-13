drop table if exists magic_login_exchanges;
drop table if exists magic_link_tokens;
drop table if exists user_identities;
drop table if exists sessions;

drop index if exists users_email_lower_idx;
alter table users add constraint users_email_key unique (email);
alter table users drop column if exists email_verified_at;
alter table users drop column if exists password_hash;
