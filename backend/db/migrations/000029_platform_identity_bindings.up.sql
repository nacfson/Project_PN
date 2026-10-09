-- Evolve user_identities for platform gateway JWT verification (001-gateway-jwt-auth)
alter table user_identities
    add column if not exists issuer text,
    add column if not exists subject text,
    add column if not exists sign_in_method text;

-- Backfill existing rows if any exist
update user_identities
set subject = provider_subject
where subject is null and provider_subject is not null;

update user_identities
set sign_in_method = case
    when provider = 'google' then 'google'
    when provider = 'apple' then 'apple'
    when provider = 'email' then 'email'
    else 'google'
end
where sign_in_method is null;

update user_identities
set issuer = 'https://auth.nacfson.cloud/realms/platform'
where issuer is null;

-- Enforce NOT NULL constraints
alter table user_identities
    alter column issuer set not null,
    alter column subject set not null,
    alter column sign_in_method set not null;

-- Enforce sign_in_method allowlist
alter table user_identities
    add constraint user_identities_sign_in_method_check
    check (sign_in_method in ('google', 'apple', 'email'));

-- Enforce UNIQUE (issuer, subject)
alter table user_identities
    add constraint user_identities_issuer_subject_unique unique (issuer, subject);

-- Drop legacy provider constraints and relax not-null for transition
alter table user_identities
    drop constraint if exists user_identities_provider_subject_unique;

alter table user_identities
    alter column provider drop not null,
    alter column provider_subject drop not null;

create index if not exists user_identities_user_id_idx on user_identities (user_id);
