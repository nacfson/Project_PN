-- Keep the oldest example per sense; drop extras before unique index.
delete from examples e
using (
  select id
  from (
    select
      id,
      row_number() over (
        partition by word_sense_id
        order by created_at asc, id asc
      ) as rn
    from examples
  ) ranked
  where rn > 1
) doomed
where e.id = doomed.id;

create unique index examples_one_per_sense_uidx on examples (word_sense_id);
