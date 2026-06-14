create index user_word_senses_active_user_added_idx
on user_word_senses (user_id, added_at desc, id desc)
where archived_at is null;
