create extension if not exists pgcrypto;

create table users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    native_language text not null,
    target_language text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table words (
    id uuid primary key default gen_random_uuid(),
    language_code text not null,
    lemma text not null,
    normalized_text text not null,
    part_of_speech text not null,
    pronunciation text,
    audio_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint words_identity_unique unique (language_code, normalized_text, part_of_speech)
);

create table word_senses (
    id uuid primary key default gen_random_uuid(),
    word_id uuid not null references words(id) on delete cascade,
    definition_language_code text not null,
    definition text not null,
    short_definition text,
    cefr_level text,
    meaning_order integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint word_senses_order_unique unique (word_id, definition_language_code, meaning_order),
    constraint word_senses_meaning_order_positive check (meaning_order > 0),
    constraint word_senses_cefr_valid check (
        cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
    )
);

create table user_word_senses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    word_sense_id uuid not null references word_senses(id) on delete cascade,
    learning_stage text not null default 'new',
    source_context text,
    personal_note text,
    difficulty_rating integer,
    added_at timestamptz not null default now(),
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_word_senses_user_sense_unique unique (user_id, word_sense_id),
    constraint user_word_senses_learning_stage_valid check (
        learning_stage in ('new', 'learning', 'recognized', 'recalled', 'usable', 'mastered', 'archived')
    ),
    constraint user_word_senses_difficulty_valid check (
        difficulty_rating is null or difficulty_rating between 1 and 5
    )
);

create table review_states (
    id uuid primary key default gen_random_uuid(),
    user_word_sense_id uuid not null references user_word_senses(id) on delete cascade,
    due_at timestamptz not null default now(),
    interval_days integer not null default 0,
    ease_factor numeric(4,2) not null default 2.50,
    last_reviewed_at timestamptz,
    review_count integer not null default 0,
    lapse_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint review_states_user_word_sense_unique unique (user_word_sense_id),
    constraint review_states_interval_nonnegative check (interval_days >= 0),
    constraint review_states_ease_factor_minimum check (ease_factor >= 1.00),
    constraint review_states_review_count_nonnegative check (review_count >= 0),
    constraint review_states_lapse_count_nonnegative check (lapse_count >= 0)
);

create table review_attempts (
    id uuid primary key default gen_random_uuid(),
    user_word_sense_id uuid not null references user_word_senses(id) on delete cascade,
    activity_type text not null,
    prompt text,
    user_answer text,
    correct_answer text,
    is_correct boolean,
    review_rating text,
    response_time_ms integer,
    confidence_rating integer,
    metadata jsonb not null default '{}'::jsonb,
    reviewed_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint review_attempts_activity_type_valid check (
        activity_type in (
            'word_to_meaning',
            'meaning_to_word',
            'cloze',
            'multiple_choice',
            'typing',
            'speaking',
            'writing',
            'sentence_creation'
        )
    ),
    constraint review_attempts_review_rating_valid check (
        review_rating is null or review_rating in ('again', 'hard', 'good', 'easy')
    ),
    constraint review_attempts_response_time_nonnegative check (
        response_time_ms is null or response_time_ms >= 0
    ),
    constraint review_attempts_confidence_rating_valid check (
        confidence_rating is null or confidence_rating between 1 and 5
    )
);

create table examples (
    id uuid primary key default gen_random_uuid(),
    word_sense_id uuid not null references word_senses(id) on delete cascade,
    sentence text not null,
    translation text,
    translation_language_code text,
    source text,
    difficulty_level text,
    cloze_text text,
    cloze_answer text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint examples_difficulty_level_valid check (
        difficulty_level is null or difficulty_level in ('easy', 'medium', 'hard')
    )
);

create index review_states_due_at_idx on review_states (due_at);
create index review_attempts_user_word_sense_reviewed_at_idx on review_attempts (user_word_sense_id, reviewed_at desc);
create index examples_word_sense_id_idx on examples (word_sense_id);
