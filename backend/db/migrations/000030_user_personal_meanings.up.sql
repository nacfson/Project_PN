create table if not exists user_personal_meanings (
    user_word_sense_id uuid primary key references user_word_senses(id) on delete cascade,
    lemma text,
    part_of_speech text,
    meaning text not null check (btrim(meaning) <> ''),
    updated_at timestamptz not null default now(),
    constraint user_personal_meanings_custom_pair_valid check (
        (lemma is null and part_of_speech is null)
        or (
            lemma is not null
            and part_of_speech is not null
            and btrim(lemma) <> ''
            and btrim(part_of_speech) <> ''
        )
    )
);

alter table user_word_senses
    alter column word_sense_id drop not null;

insert into user_personal_meanings (user_word_sense_id, meaning, updated_at)
select id, btrim(personal_note), coalesce(updated_at, now())
from user_word_senses
where personal_note is not null
  and btrim(personal_note) <> ''
on conflict (user_word_sense_id) do nothing;
