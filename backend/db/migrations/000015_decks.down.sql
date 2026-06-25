alter table user_word_senses drop constraint if exists user_word_senses_deck_id_fk;
drop index if exists user_word_senses_deck_id_idx;
alter table user_word_senses drop column if exists deck_id;

drop index if exists decks_user_target_default_unique;
drop index if exists decks_user_target_name_unique;
drop index if exists decks_user_id_idx;
drop index if exists decks_user_target_idx;

drop table if exists decks;
