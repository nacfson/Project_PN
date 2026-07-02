-- Drop dead local-auth tables and columns left over from the
-- migration to Nacfson Cloud central authentication.

drop table if exists sessions;
drop table if exists email_verification_tokens;
alter table users drop column if exists password_hash;
