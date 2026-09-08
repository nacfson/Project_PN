-- Retag multi-word lemmas to part_of_speech = 'phrase'.
-- Skip rows that would conflict with an existing (language_code, normalized_text, 'phrase') identity.

update words w
set part_of_speech = 'phrase',
    updated_at = now()
where position(' ' in w.normalized_text) > 0
  and w.part_of_speech <> 'phrase'
  and not exists (
    select 1
    from words other
    where other.language_code = w.language_code
      and other.normalized_text = w.normalized_text
      and other.part_of_speech = 'phrase'
      and other.id <> w.id
  );
