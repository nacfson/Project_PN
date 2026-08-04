-- Seed Essential English A1 curriculum pack (NGSL-inspired open lemmas; not Oxford-branded).
-- Pack id: a0000000-0000-4000-8000-0000000000a1

insert into curriculum_packs (
    id, slug, title, description, target_language, cefr_band, sort_order, is_published
) values (
    'a0000000-0000-4000-8000-0000000000a1'::uuid,
    'essential-en-a1',
    'Essential English A1',
    'A beginner core pack of high-frequency English words for everyday use. Open NGSL-inspired lemmas with Project PN definitions and examples.',
    'en',
    'A1',
    10,
    true
) on conflict (slug) do nothing;

-- Insert words, senses, examples, and pack entries.
do $$
declare
  v_pack_id uuid := 'a0000000-0000-4000-8000-0000000000a1'::uuid;
  v_word_id uuid;
  v_sense_id uuid;
  v_sort integer := 0;
begin
  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'a', 'a', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used before a singular noun when talking about one thing', 'used before a singular noun when talking about one thing', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I need a pen.', 'easy', 'a');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'about', 'about', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'on the subject of; concerning', 'on the subject of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'We talked about school.', 'easy', 'about');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'after', 'after', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'later than a time or event', 'later than a time or event', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I go home after work.', 'easy', 'after');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'again', 'again', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'one more time', 'one more time', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please say that again.', 'easy', 'again');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'all', 'all', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the whole amount or number of', 'the whole amount or number of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'All students are here.', 'easy', 'all');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'also', 'also', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'in addition; too', 'in addition', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She also speaks English.', 'easy', 'also');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'always', 'always', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'at all times; every time', 'at all times', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I always eat breakfast.', 'easy', 'always');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'and', 'and', 'conjunction')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to connect words or ideas', 'used to connect words or ideas', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Tea and coffee are ready.', 'easy', 'and');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'answer', 'answer', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'something you say or write to reply', 'something you say or write to reply', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Write your answer here.', 'easy', 'answer');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'any', 'any', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'one or some of a thing', 'one or some of a thing', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Do you have any questions?', 'easy', 'any');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'apple', 'apple', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a round fruit with red or green skin', 'a round fruit with red or green skin', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She eats an apple.', 'easy', 'apple');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'ask', 'ask', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to say something to get information', 'to say something to get information', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Can I ask a question?', 'easy', 'ask');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'at', 'at', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to show a place or time', 'used to show a place or time', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Meet me at the station.', 'easy', 'at');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'back', 'back', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to the place or time you came from', 'to the place or time you came from', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please come back soon.', 'easy', 'back');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bad', 'bad', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'not good; of low quality', 'not good', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The weather is bad today.', 'easy', 'bad');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bag', 'bag', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a container used for carrying things', 'a container used for carrying things', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Put the books in the bag.', 'easy', 'bag');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'ball', 'ball', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a round object used in games', 'a round object used in games', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'They play with a ball.', 'easy', 'ball');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'be', 'be', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to exist or have a quality', 'to exist or have a quality', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I want to be a teacher.', 'easy', 'be');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'because', 'because', 'conjunction')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'for the reason that', 'for the reason that', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I stayed home because I was tired.', 'easy', 'because');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bed', 'bed', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a piece of furniture for sleeping', 'a piece of furniture for sleeping', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Go to bed early.', 'easy', 'bed');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'before', 'before', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'earlier than a time or event', 'earlier than a time or event', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Wash your hands before dinner.', 'easy', 'before');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'begin', 'begin', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to start doing something', 'to start doing something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Let''s begin the lesson.', 'easy', 'begin');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'big', 'big', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'large in size', 'large in size', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'They live in a big house.', 'easy', 'big');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bird', 'bird', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'an animal with feathers and wings', 'an animal with feathers and wings', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'A bird is singing.', 'easy', 'bird');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'black', 'black', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'having the darkest color', 'having the darkest color', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'He wears a black coat.', 'easy', 'black');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'blue', 'blue', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'having the color of the sky', 'having the color of the sky', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The sky is blue.', 'easy', 'blue');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'book', 'book', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'pages with writing fastened together', 'pages with writing fastened together', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I read a book every night.', 'easy', 'book');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'box', 'box', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a container with a flat base and sides', 'a container with a flat base and sides', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Open the box carefully.', 'easy', 'box');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'boy', 'boy', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a male child', 'a male child', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The boy is playing outside.', 'easy', 'boy');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bread', 'bread', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'food made from flour and water', 'food made from flour and water', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'We buy fresh bread.', 'easy', 'bread');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'break', 'break', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to separate into pieces', 'to separate into pieces', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Don''t break the glass.', 'easy', 'break');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bring', 'bring', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to take something with you to a place', 'to take something with you to a place', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please bring your notebook.', 'easy', 'bring');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'brother', 'brother', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a male with the same parents as you', 'a male with the same parents as you', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'My brother is taller than me.', 'easy', 'brother');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'bus', 'bus', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a large vehicle that carries people', 'a large vehicle that carries people', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I take the bus to school.', 'easy', 'bus');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'but', 'but', 'conjunction')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to show a contrast', 'used to show a contrast', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I like tea but not coffee.', 'easy', 'but');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'buy', 'buy', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to get something by paying money', 'to get something by paying money', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I want to buy a ticket.', 'easy', 'buy');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'by', 'by', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'near or beside; using a method', 'near or beside', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She travels by train.', 'easy', 'by');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'call', 'call', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to phone or shout to someone', 'to phone or shout to someone', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please call me later.', 'easy', 'call');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'can', 'can', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to be able to do something', 'to be able to do something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I can swim well.', 'easy', 'can');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'car', 'car', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a road vehicle with four wheels', 'a road vehicle with four wheels', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'They drive a small car.', 'easy', 'car');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'cat', 'cat', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a small animal often kept as a pet', 'a small animal often kept as a pet', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The cat sleeps on the sofa.', 'easy', 'cat');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'chair', 'chair', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a seat with a back for one person', 'a seat with a back for one person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Sit on this chair.', 'easy', 'chair');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'child', 'child', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a young person', 'a young person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Every child needs love.', 'easy', 'child');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'city', 'city', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a large town', 'a large town', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Tokyo is a big city.', 'easy', 'city');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'class', 'class', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a group of students learning together', 'a group of students learning together', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Our class starts at nine.', 'easy', 'class');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'clean', 'clean', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'not dirty', 'not dirty', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Keep your room clean.', 'easy', 'clean');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'close', 'close', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to shut something', 'to shut something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please close the door.', 'easy', 'close');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'cold', 'cold', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'having a low temperature', 'having a low temperature', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'It is cold in winter.', 'easy', 'cold');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'come', 'come', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to move toward a place', 'to move toward a place', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Come to my house tomorrow.', 'easy', 'come');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'country', 'country', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'an area of land with its own government', 'an area of land with its own government', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Japan is a beautiful country.', 'easy', 'country');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'day', 'day', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a period of 24 hours', 'a period of 24 hours', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Today is a good day.', 'easy', 'day');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'do', 'do', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to perform an action', 'to perform an action', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'What do you want to do?', 'easy', 'do');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'dog', 'dog', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'an animal often kept as a pet', 'an animal often kept as a pet', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The dog runs in the park.', 'easy', 'dog');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'door', 'door', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a way into a building or room', 'a way into a building or room', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Open the door please.', 'easy', 'door');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'drink', 'drink', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to take liquid into your mouth', 'to take liquid into your mouth', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I drink water every day.', 'easy', 'drink');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'eat', 'eat', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to put food in your mouth and swallow it', 'to put food in your mouth and swallow it', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'We eat dinner at seven.', 'easy', 'eat');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'egg', 'egg', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a round object laid by a bird', 'a round object laid by a bird', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I had an egg for breakfast.', 'easy', 'egg');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'eight', 'eight', 'number')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the number 8', 'the number 8', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'There are eight chairs.', 'easy', 'eight');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'end', 'end', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the last part of something', 'the last part of something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This is the end of the story.', 'easy', 'end');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'english', 'english', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the English language', 'the English language', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I study English every day.', 'easy', 'english');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'evening', 'evening', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the part of the day after afternoon', 'the part of the day after afternoon', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'See you this evening.', 'easy', 'evening');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'every', 'every', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'each one of a group', 'each one of a group', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I walk every morning.', 'easy', 'every');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'eye', 'eye', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the part of the body used for seeing', 'the part of the body used for seeing', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She has blue eyes.', 'easy', 'eye');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'face', 'face', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the front part of the head', 'the front part of the head', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Wash your face.', 'easy', 'face');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'family', 'family', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'parents and their children', 'parents and their children', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'My family lives in Seoul.', 'easy', 'family');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'far', 'far', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'at a great distance', 'at a great distance', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The station is not far.', 'easy', 'far');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'father', 'father', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a male parent', 'a male parent', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'My father works in an office.', 'easy', 'father');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'feel', 'feel', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to experience an emotion or sensation', 'to experience an emotion or sensation', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I feel happy today.', 'easy', 'feel');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'few', 'few', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a small number of', 'a small number of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I have a few friends here.', 'easy', 'few');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'find', 'find', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to discover or locate something', 'to discover or locate something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I can''t find my keys.', 'easy', 'find');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'fine', 'fine', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'good or acceptable', 'good or acceptable', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I am fine, thank you.', 'easy', 'fine');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'first', 'first', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'coming before all others', 'coming before all others', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This is my first class.', 'easy', 'first');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'fish', 'fish', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'an animal that lives in water', 'an animal that lives in water', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'They catch fish in the river.', 'easy', 'fish');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'five', 'five', 'number')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the number 5', 'the number 5', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I have five books.', 'easy', 'five');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'floor', 'floor', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the surface you walk on indoors', 'the surface you walk on indoors', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The floor is clean.', 'easy', 'floor');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'food', 'food', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'things that people eat', 'things that people eat', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Korean food is delicious.', 'easy', 'food');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'foot', 'foot', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the end part of the leg', 'the end part of the leg', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'My left foot hurts.', 'easy', 'foot');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'for', 'for', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to show purpose or benefit', 'used to show purpose or benefit', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This gift is for you.', 'easy', 'for');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'four', 'four', 'number')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the number 4', 'the number 4', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'There are four seasons.', 'easy', 'four');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'friend', 'friend', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a person you know and like', 'a person you know and like', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She is my best friend.', 'easy', 'friend');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'from', 'from', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'showing the starting point', 'showing the starting point', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I am from Korea.', 'easy', 'from');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'get', 'get', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to receive or obtain something', 'to receive or obtain something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Did you get my message?', 'easy', 'get');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'girl', 'girl', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a female child', 'a female child', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The girl is reading.', 'easy', 'girl');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'give', 'give', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to hand something to someone', 'to hand something to someone', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please give me the book.', 'easy', 'give');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'go', 'go', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to move from one place to another', 'to move from one place to another', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I go to school by bus.', 'easy', 'go');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'good', 'good', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'of high quality; pleasant', 'of high quality', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This is a good idea.', 'easy', 'good');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'great', 'great', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'very good or important', 'very good or important', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'We had a great time.', 'easy', 'great');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'green', 'green', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'having the color of grass', 'having the color of grass', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The leaves are green.', 'easy', 'green');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'hand', 'hand', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the part of the body at the end of the arm', 'the part of the body at the end of the arm', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Raise your hand.', 'easy', 'hand');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'happy', 'happy', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'feeling pleasure or joy', 'feeling pleasure or joy', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I am happy to see you.', 'easy', 'happy');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'have', 'have', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to own or possess something', 'to own or possess something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I have two sisters.', 'easy', 'have');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'he', 'he', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used for a male person', 'used for a male person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'He is my teacher.', 'easy', 'he');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'head', 'head', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the top part of the body', 'the top part of the body', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Wear a hat on your head.', 'easy', 'head');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'hear', 'hear', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to notice a sound with your ears', 'to notice a sound with your ears', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Can you hear the music?', 'easy', 'hear');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'help', 'help', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to make it easier for someone to do something', 'to make it easier for someone to do something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Can you help me?', 'easy', 'help');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'her', 'her', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'belonging to a female person', 'belonging to a female person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This is her bag.', 'easy', 'her');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'here', 'here', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'in this place', 'in this place', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please sit here.', 'easy', 'here');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'him', 'him', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used for a male person as object', 'used for a male person as object', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I gave him a gift.', 'easy', 'him');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'his', 'his', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'belonging to a male person', 'belonging to a male person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'His name is Tom.', 'easy', 'his');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'home', 'home', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the place where you live', 'the place where you live', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I go home after class.', 'easy', 'home');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'hot', 'hot', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'having a high temperature', 'having a high temperature', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The soup is hot.', 'easy', 'hot');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'hour', 'hour', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a period of 60 minutes', 'a period of 60 minutes', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The class lasts one hour.', 'easy', 'hour');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'house', 'house', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a building where people live', 'a building where people live', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'They bought a new house.', 'easy', 'house');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'how', 'how', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'in what way', 'in what way', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'How do you spell this word?', 'easy', 'how');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'i', 'i', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used by a speaker to refer to themselves', 'used by a speaker to refer to themselves', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I am a student.', 'easy', 'i');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'if', 'if', 'conjunction')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'on the condition that', 'on the condition that', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Call me if you need help.', 'easy', 'if');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'in', 'in', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'inside a place or period of time', 'inside a place or period of time', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The keys are in the bag.', 'easy', 'in');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'into', 'into', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to the inside of', 'to the inside of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She walked into the room.', 'easy', 'into');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'it', 'it', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used for a thing or animal', 'used for a thing or animal', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'It is raining.', 'easy', 'it');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'job', 'job', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'work that you do for money', 'work that you do for money', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She has a good job.', 'easy', 'job');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'just', 'just', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a short time ago; only', 'a short time ago', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I just arrived.', 'easy', 'just');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'keep', 'keep', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to continue to have something', 'to continue to have something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Keep your ticket.', 'easy', 'keep');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'kind', 'kind', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'friendly and helpful', 'friendly and helpful', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'He is a kind person.', 'easy', 'kind');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'know', 'know', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to have information in your mind', 'to have information in your mind', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I know the answer.', 'easy', 'know');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'language', 'language', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a system of words used by people', 'a system of words used by people', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'English is a useful language.', 'easy', 'language');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'learn', 'learn', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to get knowledge or skill', 'to get knowledge or skill', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I want to learn English.', 'easy', 'learn');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'leave', 'leave', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to go away from a place', 'to go away from a place', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'We leave at noon.', 'easy', 'leave');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'left', 'left', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'on the side of your body that is west when facing north', 'on the side of your body that is west when facing north', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Turn left at the corner.', 'easy', 'left');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'let', 'let', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to allow someone to do something', 'to allow someone to do something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Let me help you.', 'easy', 'let');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'letter', 'letter', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a written message you send', 'a written message you send', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I wrote a letter to my friend.', 'easy', 'letter');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'life', 'life', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the time when a person is alive', 'the time when a person is alive', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Life in the city is busy.', 'easy', 'life');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'like', 'like', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to enjoy or find pleasant', 'to enjoy or find pleasant', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I like coffee.', 'easy', 'like');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'listen', 'listen', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to pay attention to sound', 'to pay attention to sound', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Please listen carefully.', 'easy', 'listen');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'little', 'little', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'small in size', 'small in size', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'She has a little dog.', 'easy', 'little');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'live', 'live', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to have your home in a place', 'to have your home in a place', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I live in Busan.', 'easy', 'live');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'long', 'long', 'adjective')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'measuring a great distance or time', 'measuring a great distance or time', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'It was a long day.', 'easy', 'long');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'look', 'look', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to turn your eyes toward something', 'to turn your eyes toward something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Look at the picture.', 'easy', 'look');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'love', 'love', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to like someone or something very much', 'to like someone or something very much', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I love my family.', 'easy', 'love');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'make', 'make', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to create or produce something', 'to create or produce something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I make breakfast every day.', 'easy', 'make');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'man', 'man', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'an adult male person', 'an adult male person', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The man is waiting.', 'easy', 'man');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'many', 'many', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a large number of', 'a large number of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Many people came.', 'easy', 'many');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'may', 'may', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to ask for or give permission', 'used to ask for or give permission', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'May I open the window?', 'easy', 'may');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'me', 'me', 'pronoun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used by a speaker as the object', 'used by a speaker as the object', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Can you help me?', 'easy', 'me');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'mean', 'mean', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to have a particular meaning', 'to have a particular meaning', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'What does this word mean?', 'easy', 'mean');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'meet', 'meet', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to see and speak to someone for the first time or by arrangement', 'to see and speak to someone for the first time or by arra...', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Nice to meet you.', 'easy', 'meet');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'milk', 'milk', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a white liquid from cows', 'a white liquid from cows', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I drink milk every morning.', 'easy', 'milk');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'minute', 'minute', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a period of 60 seconds', 'a period of 60 seconds', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Wait a minute.', 'easy', 'minute');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'money', 'money', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'coins or notes used to buy things', 'coins or notes used to buy things', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I need some money.', 'easy', 'money');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'month', 'month', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'one of the twelve parts of a year', 'one of the twelve parts of a year', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'June is my favorite month.', 'easy', 'month');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'more', 'more', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a greater amount or number', 'a greater amount or number', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I need more time.', 'easy', 'more');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'morning', 'morning', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the early part of the day', 'the early part of the day', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'Good morning.', 'easy', 'morning');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'mother', 'mother', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a female parent', 'a female parent', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'My mother is a doctor.', 'easy', 'mother');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'much', 'much', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'a large amount of', 'a large amount of', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I don''t have much time.', 'easy', 'much');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'music', 'music', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'sounds arranged to be pleasant', 'sounds arranged to be pleasant', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I listen to music.', 'easy', 'music');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'must', 'must', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'used to say that something is necessary', 'used to say that something is necessary', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'You must wear a seatbelt.', 'easy', 'must');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'my', 'my', 'determiner')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'belonging to me', 'belonging to me', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'This is my phone.', 'easy', 'my');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'name', 'name', 'noun')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'the word used for a person or thing', 'the word used for a person or thing', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'What is your name?', 'easy', 'name');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'near', 'near', 'preposition')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'close to', 'close to', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'The shop is near the station.', 'easy', 'near');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'need', 'need', 'verb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'to require something', 'to require something', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I need help.', 'easy', 'need');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

  v_sort := v_sort + 1;
  insert into words (language_code, lemma, normalized_text, part_of_speech)
  values ('en', 'never', 'never', 'adverb')
  on conflict (language_code, normalized_text, part_of_speech) do update set updated_at = now()
  returning id into v_word_id;
  v_sense_id := null;
  select id into v_sense_id from word_senses where word_id = v_word_id and meaning_order = 1;
  if v_sense_id is null then
    insert into word_senses (word_id, definition, short_definition, cefr_level, meaning_order)
    values (v_word_id, 'at no time', 'at no time', 'A1', 1)
    returning id into v_sense_id;
    insert into examples (word_sense_id, sentence, difficulty_level, cloze_answer)
    values (v_sense_id, 'I never eat meat.', 'easy', 'never');
  end if;
  insert into curriculum_pack_entries (pack_id, word_sense_id, sort_order, cefr_level)
  values (v_pack_id, v_sense_id, v_sort, 'A1')
  on conflict (pack_id, word_sense_id) do nothing;

end $$;
