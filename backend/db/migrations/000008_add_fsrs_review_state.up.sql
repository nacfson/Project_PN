alter table review_states
add column fsrs_state text not null default 'New',
add column stability double precision not null default 0,
add column difficulty double precision not null default 0,
add column scheduled_days integer not null default 0,
add column remaining_steps integer not null default 0;

alter table review_states
add constraint review_states_fsrs_state_valid
  check (fsrs_state in ('New', 'Learning', 'Review', 'Relearning')),
add constraint review_states_stability_nonnegative
  check (stability >= 0),
add constraint review_states_difficulty_nonnegative
  check (difficulty >= 0),
add constraint review_states_scheduled_days_nonnegative
  check (scheduled_days >= 0),
add constraint review_states_remaining_steps_nonnegative
  check (remaining_steps >= 0);

update review_states
set fsrs_state = case when review_count > 0 then 'Review' else 'New' end,
    scheduled_days = interval_days,
    stability = case when review_count > 0 and interval_days > 0 then interval_days::double precision else 0 end,
    difficulty = case
      when review_count > 0 then least(10.0, greatest(1.0, 11.0 - (ease_factor::double precision * 3.0)))
      else 0
    end;
