update user_word_senses uws
set personal_note = pm.meaning,
    updated_at = now()
from user_personal_meanings pm
where pm.user_word_sense_id = uws.id
  and pm.lemma is null
  and uws.word_sense_id is not null;

delete from user_word_senses
where word_sense_id is null;

alter table user_word_senses
    alter column word_sense_id set not null;

drop table if exists user_personal_meanings;
