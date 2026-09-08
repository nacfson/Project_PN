-- Production follow-up for 000025: the original all-rows UPDATE can fail with
-- words_identity_unique when two POS variants of the same multi-word lemma
-- both try to become 'phrase' in one statement (golang-migrate then leaves
-- version dirty / requires force). Re-apply the retag with one-row-per-lemma
-- selection. Idempotent when a phrase row already exists.

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
