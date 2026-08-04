-- Curriculum vocabulary origin: shared packs + per-user enrollment decks.

create table curriculum_packs (
    id uuid primary key default gen_random_uuid(),
    slug text not null,
    title text not null,
    description text not null default '',
    target_language text not null,
    cefr_band text not null,
    sort_order integer not null default 0,
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint curriculum_packs_slug_unique unique (slug),
    constraint curriculum_packs_cefr_band_valid check (
        cefr_band in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'A1-A2', 'A1-B2', 'B1-C1')
    ),
    constraint curriculum_packs_sort_order_nonnegative check (sort_order >= 0)
);

create index curriculum_packs_published_idx
    on curriculum_packs (is_published, sort_order, slug);

create table curriculum_pack_entries (
    id uuid primary key default gen_random_uuid(),
    pack_id uuid not null references curriculum_packs(id) on delete cascade,
    word_sense_id uuid not null references word_senses(id) on delete cascade,
    sort_order integer not null default 0,
    cefr_level text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint curriculum_pack_entries_pack_sense_unique unique (pack_id, word_sense_id),
    constraint curriculum_pack_entries_sort_order_nonnegative check (sort_order >= 0),
    constraint curriculum_pack_entries_cefr_valid check (
        cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
    )
);

create index curriculum_pack_entries_pack_id_idx
    on curriculum_pack_entries (pack_id, sort_order, id);

alter table decks
    add column origin text not null default 'private',
    add column curriculum_pack_id uuid null references curriculum_packs(id) on delete restrict;

alter table decks
    add constraint decks_origin_valid check (origin in ('private', 'curriculum'));

alter table decks
    add constraint decks_curriculum_pack_origin_consistent check (
        (origin = 'private' and curriculum_pack_id is null)
        or (origin = 'curriculum' and curriculum_pack_id is not null and is_default = false)
    );

create unique index decks_user_curriculum_pack_unique
    on decks (user_id, curriculum_pack_id)
    where curriculum_pack_id is not null;

create table user_curriculum_enrollments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    pack_id uuid not null references curriculum_packs(id) on delete cascade,
    deck_id uuid not null references decks(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_curriculum_enrollments_user_pack_unique unique (user_id, pack_id),
    constraint user_curriculum_enrollments_deck_unique unique (deck_id)
);

create index user_curriculum_enrollments_user_id_idx
    on user_curriculum_enrollments (user_id);
