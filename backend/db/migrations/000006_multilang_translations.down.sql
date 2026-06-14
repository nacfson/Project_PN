drop table if exists example_translations;
drop table if exists sense_translations;

alter table examples add column translation text;
alter table examples add column translation_language_code text;

alter table word_senses drop constraint word_senses_order_unique;
alter table word_senses add column definition_language_code text;
alter table word_senses add constraint word_senses_order_unique unique (word_id, definition_language_code, meaning_order);
