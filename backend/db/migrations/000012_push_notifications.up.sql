create table device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index device_push_tokens_user_id_idx on device_push_tokens (user_id);

create table notification_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  sent_at timestamptz not null default now()
);

create index notification_sends_user_sent_at_idx on notification_sends (user_id, sent_at desc);
