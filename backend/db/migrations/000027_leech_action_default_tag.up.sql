-- Product default: keep leech cards in quiz (tag), do not auto-suspend.
alter table review_settings
  alter column leech_action set default 'tag';

-- Migrate existing rows still on the old product default.
update review_settings
set leech_action = 'tag', updated_at = now()
where leech_action = 'suspend';
