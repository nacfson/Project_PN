alter table review_states
drop constraint if exists review_states_remaining_steps_nonnegative,
drop constraint if exists review_states_scheduled_days_nonnegative,
drop constraint if exists review_states_difficulty_nonnegative,
drop constraint if exists review_states_stability_nonnegative,
drop constraint if exists review_states_fsrs_state_valid;

alter table review_states
drop column if exists remaining_steps,
drop column if exists scheduled_days,
drop column if exists difficulty,
drop column if exists stability,
drop column if exists fsrs_state;
