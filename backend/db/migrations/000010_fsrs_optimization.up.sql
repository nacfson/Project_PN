alter table review_settings
add column fsrs_weights double precision[] not null default
  '{0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
    1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
    1.8729, 0.5425, 0.0912}',
add column weights_optimized_at timestamptz,
add column weights_review_count integer not null default 0;
