create table decks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    target_language text not null,
    name text not null,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index decks_user_target_default_unique
    on decks (user_id, target_language) where is_default = true;

create unique index decks_user_target_name_unique
    on decks (user_id, target_language, lower(name));

create index decks_user_id_idx on decks (user_id);
create index decks_user_target_idx on decks (user_id, target_language);

alter table user_word_senses add column deck_id uuid;
create index user_word_senses_deck_id_idx on user_word_senses (deck_id);

-- Seed default decks for every language pair the user is learning.
insert into decks (user_id, target_language, name, is_default)
select user_id, target_language, target_language || ' (Default)', true
from user_languages
where not exists (
    select 1 from decks d
    where d.user_id = user_languages.user_id
      and d.target_language = user_languages.target_language
      and d.is_default = true
);

-- Seed default decks for legacy users without user_languages.
insert into decks (user_id, target_language, name, is_default)
select id, target_language, target_language || ' (Default)', true
from users
where not exists (select 1 from user_languages ul where ul.user_id = users.id)
  and not exists (
      select 1 from decks d
      where d.user_id = users.id
        and d.target_language = users.target_language
        and d.is_default = true
  );

-- Backfill items whose word language already matches an existing default deck.
update user_word_senses uws
set deck_id = d.id
from word_senses ws
join words w on w.id = ws.word_id
join decks d on d.user_id = uws.user_id
            and d.target_language = w.language_code
            and d.is_default = true
where uws.word_sense_id = ws.id
  and uws.deck_id is null;

-- Create default decks for any remaining word languages that lack one.
insert into decks (user_id, target_language, name, is_default)
select distinct uws.user_id, w.language_code, w.language_code || ' (Default)', true
from user_word_senses uws
join word_senses ws on ws.id = uws.word_sense_id
join words w on w.id = ws.word_id
where uws.deck_id is null
  and not exists (
      select 1 from decks d
      where d.user_id = uws.user_id
        and d.target_language = w.language_code
        and d.is_default = true
  );

-- Backfill remaining items.
update user_word_senses uws
set deck_id = d.id
from word_senses ws
join words w on w.id = ws.word_id
join decks d on d.user_id = uws.user_id
            and d.target_language = w.language_code
            and d.is_default = true
where uws.word_sense_id = ws.id
  and uws.deck_id is null;

-- Safety net: if anything is still null (should not happen), assign an 'und' default deck.
insert into decks (user_id, target_language, name, is_default)
select distinct uws.user_id, 'und', 'und (Default)', true
from user_word_senses uws
where uws.deck_id is null
  and not exists (
      select 1 from decks d
      where d.user_id = uws.user_id and d.target_language = 'und' and d.is_default = true
  );

update user_word_senses uws
set deck_id = d.id
from decks d
where uws.user_id = d.user_id
  and d.target_language = 'und'
  and d.is_default = true
  and uws.deck_id is null;

alter table user_word_senses alter column deck_id set not null;
alter table user_word_senses add constraint user_word_senses_deck_id_fk
    foreign key (deck_id) references decks(id) on delete restrict;
