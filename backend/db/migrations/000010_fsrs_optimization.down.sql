alter table review_settings
drop column if exists fsrs_weights,
drop column if exists weights_optimized_at,
drop column if exists weights_review_count;
