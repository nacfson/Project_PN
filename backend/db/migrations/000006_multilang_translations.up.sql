-- 000006 is a DEV-RESET migration. It does not migrate existing word_senses
-- rows across definition languages. Run on a fresh/dev DB.
do $$
begin
  if exists (
    select 1 from word_senses
    group by word_id, meaning_order
    having count(*) > 1
  ) then
    raise exception
      '000006 would collapse multiple definition languages into (word_id, meaning_order). Reset the dev DB (migrate down to base) before applying.';
  end if;
end $$;

alter table word_senses drop constraint word_senses_order_unique;
alter table word_senses drop column definition_language_code;
alter table word_senses add constraint word_senses_order_unique unique (word_id, meaning_order);

alter table examples drop column translation;
alter table examples drop column translation_language_code;

create table sense_translations (
    id uuid primary key default gen_random_uuid(),
    word_sense_id uuid not null references word_senses(id) on delete cascade,
    language_code text not null,
    definition text not null,
    short_definition text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sense_translations_unique unique (word_sense_id, language_code)
);

create index sense_translations_sense_lang_idx on sense_translations (word_sense_id, language_code);

create table example_translations (
    id uuid primary key default gen_random_uuid(),
    example_id uuid not null references examples(id) on delete cascade,
    language_code text not null,
    translation text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint example_translations_unique unique (example_id, language_code)
);

create index example_translations_example_lang_idx on example_translations (example_id, language_code);
