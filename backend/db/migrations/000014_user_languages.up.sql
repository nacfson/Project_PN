create table user_languages (
    user_id uuid not null references users(id) on delete cascade,
    target_language text not null,
    display_language text not null,
    is_active boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_languages_pk primary key (user_id, target_language)
);

-- Exactly one active learning pair per user.
create unique index user_languages_active_unique
    on user_languages (user_id)
    where is_active = true;

create index user_languages_user_id_idx
    on user_languages (user_id);

-- UI language is independent from learning display language.
alter table users add column ui_language text not null default 'en';

-- Seed from existing users. Existing users keep their current pair as active.
-- The legacy native_language becomes the learning display_language.
insert into user_languages (user_id, target_language, display_language, is_active)
select id, target_language, native_language, true
from users
on conflict (user_id, target_language) do nothing;

-- Seed UI language from the user's display language when it is a supported UI
-- language; otherwise keep the 'en' default added above.
update users
set ui_language = native_language
where native_language in ('en', 'ko');
