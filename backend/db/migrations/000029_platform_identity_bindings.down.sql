-- Revert platform identity bindings migration
alter table user_identities
    drop constraint if exists user_identities_issuer_subject_unique,
    drop constraint if exists user_identities_sign_in_method_check;

alter table user_identities
    drop column if exists issuer,
    drop column if exists subject,
    drop column if exists sign_in_method;

-- Restore legacy constraints if provider and provider_subject exist
alter table user_identities
    add constraint user_identities_provider_subject_unique unique (provider, provider_subject);
