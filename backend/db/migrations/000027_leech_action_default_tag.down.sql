alter table review_settings
  alter column leech_action set default 'suspend';

update review_settings
set leech_action = 'suspend', updated_at = now()
where leech_action = 'tag';
