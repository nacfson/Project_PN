-- Platform Identity Migration Script Template
-- Feature: 001-gateway-jwt-auth
-- Ref: specs/001-gateway-jwt-auth/contracts/operator-migration.md
-- Runbook: backend/docs/platform-identity-migration.md
--
-- PURPOSE:
-- Binds an existing local Project PN account (users.id) to a Keycloak (issuer, subject)
-- BEFORE production cutover so learner progress (words, decks, reviews, FSRS states)
-- is seamlessly preserved when signing in via Google on the platform Keycloak realm.
--
-- CONSTRAINTS:
-- - NEVER wipes or truncates users, decks, words, or learning tables.
-- - Primary key / uniqueness is strictly (issuer, subject).
-- - Live sign_in_method is 'google' (apple/email reserved).
-- - Does NOT grant admin roles or privileges.
--
-- USAGE (via psql or db proxy):
-- Replace values below in transaction block:

BEGIN;

-- 1. Check existing user account and learning assets
-- Replace with the target user's email or UUID:
DO $$
DECLARE
    v_user_id UUID;
    v_target_email TEXT := 'learner@example.com'; -- << OPERATOR INPUT
    v_issuer TEXT := 'https://auth.nacfson.cloud/realms/platform';
    v_subject TEXT := 'REPLACE_WITH_KEYCLOAK_SUB'; -- << OPERATOR INPUT (UUID or sub string from Keycloak)
    v_sign_in_method TEXT := 'google';
    v_deck_count INT;
    v_item_count INT;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE lower(email) = lower(v_target_email);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user not found with email %', v_target_email;
    END IF;

    -- Count existing learning assets to verify continuity
    SELECT count(*) INTO v_deck_count FROM decks WHERE user_id = v_user_id;
    SELECT count(*) INTO v_item_count FROM user_word_senses WHERE user_id = v_user_id;
    RAISE NOTICE 'Found user % (%) with % decks and % learning items', v_user_id, v_target_email, v_deck_count, v_item_count;

    -- 2. Upsert identity binding with verbatim constraints
    INSERT INTO user_identities (
        user_id,
        issuer,
        subject,
        sign_in_method,
        email_at_provider,
        provider,
        provider_subject,
        created_at,
        updated_at
    )
    VALUES (
        v_user_id,
        v_issuer,
        v_subject,
        v_sign_in_method,
        lower(v_target_email),
        v_sign_in_method,
        v_subject,
        now(),
        now()
    )
    ON CONFLICT (issuer, subject) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        sign_in_method = EXCLUDED.sign_in_method,
        email_at_provider = EXCLUDED.email_at_provider,
        updated_at = now();

    RAISE NOTICE 'Successfully bound user % to issuer % and subject %', v_user_id, v_issuer, v_subject;
END $$;

COMMIT;

-- Verification query:
-- SELECT u.id, u.email, ui.issuer, ui.subject, ui.sign_in_method, ui.updated_at
-- FROM users u
-- JOIN user_identities ui ON u.id = ui.user_id
-- WHERE ui.issuer = 'https://auth.nacfson.cloud/realms/platform';
