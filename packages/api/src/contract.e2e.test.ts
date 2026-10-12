/**
 * Client-vs-backend contract check (spec 002, FR-009).
 *
 * Runs the real shared API client (`@project-pn/api`) against a real, running
 * backend and asserts that the response shapes the client types rely on are
 * still returned. It is skipped in the default unit run and executed by
 * `npm run test:contract -w packages/api` / the `contract-e2e` CI job, which
 * set CONTRACT_E2E_BASE_URL. When the variable is set, an unreachable backend
 * FAILS the test (it never silently skips).
 *
 * The backend must run with AUTH_DEV_BYPASS=true (local/ephemeral only).
 */
import { configureApi } from './client';
import { listDecks } from './decks';
import { listLearningItems } from './learningItems';
import { me } from './auth';
import type { Deck, LearningItemsPage, MeResponse } from './types';

const baseUrl = process.env.CONTRACT_E2E_BASE_URL;
const contract = baseUrl ? describe : describe.skip;

// Dev bypass token: local/ephemeral backends only, never production.
const DEV_TOKEN = 'mock-dev-token';

contract('client/backend contract', () => {
  beforeAll(() => {
    configureApi({
      baseUrls: [baseUrl as string],
      authMode: 'bearer',
      getToken: async () => DEV_TOKEN,
    });
  });

  it('GET /api/auth/me matches MeResponse', async () => {
    const res: MeResponse = await me();
    expect(typeof res.id).toBe('string');
    expect(typeof res.email).toBe('string');
    expect(typeof res.email_verified).toBe('boolean');
    expect(typeof res.native_language).toBe('string');
    expect(typeof res.target_language).toBe('string');
    expect(typeof res.ui_language).toBe('string');
    expect(res.active_language).toBeTruthy();
  });

  it('GET /api/decks matches Deck[]', async () => {
    const decks: Deck[] = await listDecks();
    expect(Array.isArray(decks)).toBe(true);
    for (const deck of decks) {
      expect(typeof deck.id).toBe('string');
      expect(typeof deck.user_id).toBe('string');
      expect(typeof deck.target_language).toBe('string');
      expect(typeof deck.name).toBe('string');
      expect(typeof deck.is_default).toBe('boolean');
      expect(typeof deck.origin).toBe('string');
      expect(typeof deck.item_count).toBe('number');
      expect(typeof deck.created_at).toBe('string');
      expect(typeof deck.updated_at).toBe('string');
    }
  });

  it('GET /api/learning-items matches LearningItemsPage', async () => {
    const page: LearningItemsPage = await listLearningItems({ limit: 5 });
    expect(Array.isArray(page.items)).toBe(true);
    expect('next_cursor' in page).toBe(true);
    expect(page.next_cursor === null || typeof page.next_cursor === 'string').toBe(true);
  });
});
