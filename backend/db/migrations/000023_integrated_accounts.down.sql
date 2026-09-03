drop table if exists account_merge_requests;
drop index if exists user_identities_one_nacfson_per_user;
drop index if exists user_identities_one_google_per_user;
alter table user_identities drop column if exists linked_at;
