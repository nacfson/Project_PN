-- Remove curriculum packs origin. Move any curriculum-deck learning items
-- onto each user's default private deck for that language, then drop curriculum
-- tables and deck origin columns.

-- Ensure a default private deck exists for every (user, language) that has
-- curriculum-deck items, then reassign those items.
insert into decks (user_id, target_language, name, is_default, origin)
select distinct d.user_id, d.target_language, 'Default', true, 'private'
from decks d
where d.origin = 'curriculum'
  and not exists (
    select 1 from decks p
    where p.user_id = d.user_id
      and p.target_language = d.target_language
      and p.is_default = true
      and p.origin = 'private'
  );

update user_word_senses uws
set deck_id = p.id,
    updated_at = now()
from decks c
join decks p
  on p.user_id = c.user_id
 and p.target_language = c.target_language
 and p.is_default = true
 and coalesce(p.origin, 'private') = 'private'
where uws.deck_id = c.id
  and c.origin = 'curriculum';

delete from user_curriculum_enrollments;
delete from decks where origin = 'curriculum';

drop table if exists user_curriculum_enrollments;
drop table if exists curriculum_pack_entries;

drop index if exists decks_user_curriculum_pack_unique;

alter table decks drop constraint if exists decks_curriculum_pack_origin_consistent;
alter table decks drop constraint if exists decks_origin_valid;
alter table decks drop constraint if exists decks_curriculum_pack_id_fkey;

alter table decks drop column if exists curriculum_pack_id;
alter table decks drop column if exists origin;

drop table if exists curriculum_packs;
