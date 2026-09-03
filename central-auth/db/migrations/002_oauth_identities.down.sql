alter table sessions drop column if exists provider_subject;
alter table sessions drop column if exists auth_provider;
drop table if exists oauth_states;
drop table if exists user_identities;
