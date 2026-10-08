drop table if exists magic_link_tokens;
drop index if exists user_identities_one_magic_per_user;

alter table user_identities
    drop constraint if exists user_identities_provider_check;

alter table user_identities
    add constraint user_identities_provider_check
    check (provider = 'google');
