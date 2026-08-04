drop table if exists user_curriculum_enrollments;
drop index if exists decks_user_curriculum_pack_unique;
alter table decks drop constraint if exists decks_curriculum_pack_origin_consistent;
alter table decks drop constraint if exists decks_origin_valid;
alter table decks drop column if exists curriculum_pack_id;
alter table decks drop column if exists origin;
drop table if exists curriculum_pack_entries;
drop table if exists curriculum_packs;
