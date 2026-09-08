-- Retag multi-word lemmas to part_of_speech = 'phrase'.
-- When multiple POS variants exist for the same lemma (e.g. noun + pronoun),
-- only one row is updated — the oldest by created_at/id — so we do not violate
-- words_identity_unique by collapsing two rows onto 'phrase' in one statement.
-- Remaining non-phrase siblings are left as-is (merging senses is out of scope).

with ranked as (
  select w.id,
         row_number() over (
           partition by w.language_code, w.normalized_text
           order by w.created_at asc nulls last, w.id asc
         ) as rn
  from words w
  where position(' ' in w.normalized_text) > 0
    and w.part_of_speech <> 'phrase'
    and not exists (
      select 1
      from words other
      where other.language_code = w.language_code
        and other.normalized_text = w.normalized_text
        and other.part_of_speech = 'phrase'
        and other.id <> w.id
    )
)
update words w
set part_of_speech = 'phrase',
    updated_at = now()
from ranked r
where w.id = r.id
  and r.rn = 1;
