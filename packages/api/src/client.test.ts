import type { MeResponse, LanguageOptionsResponse, AllowedLanguages } from './types';
import { configureApi, getJson, postJson, ApiError } from './client';

beforeEach(() => {
  configureApi({
    baseUrls: ['http://localhost:9999'],
    getToken: async () => 'token',
  });
});

test('attaches Authorization header', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
  await getJson('/test');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:9999/test',
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
  );
});

test('uses the browser cookie session without a bearer header', async () => {
  configureApi({
    baseUrls: ['http://localhost:9999'],
    authMode: 'cookie',
    getToken: async () => 'must-not-be-used',
    getCsrfToken: () => 'csrf-token',
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => '{}',
  });

  await getJson('/api/auth/me');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:9999/api/auth/me',
    expect.objectContaining({
      credentials: 'include',
      headers: expect.not.objectContaining({ Authorization: expect.anything() }),
    }),
  );

  await postJson('/api/learning-items', { word_sense_id: 'sense-1' });
  expect(global.fetch).toHaveBeenLastCalledWith(
    'http://localhost:9999/api/learning-items',
    expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'X-CSRF-Token': 'csrf-token' }),
    }),
  );
});

test('throws ApiError on non-ok response', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ error: 'boom' }),
  });
  await expect(getJson('/test')).rejects.toBeInstanceOf(ApiError);
});

test('retries once after refreshing an expired bearer session', async () => {
  const onSessionRefreshed = jest.fn();
  configureApi({
    baseUrls: ['http://localhost:9999'],
    getToken: async () => 'new-access',
    getRefreshToken: async () => 'old-refresh',
    onSessionRefreshed,
  });

  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'unauthorized' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          token: 'new-access',
          refresh_token: 'new-refresh',
          expires_at: '2099-01-01T00:00:00Z',
        }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });

  const result = await getJson<{ ok: boolean }>('/api/auth/me');
  expect(result.ok).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(onSessionRefreshed).toHaveBeenCalledWith({
    token: 'new-access',
    refresh_token: 'new-refresh',
    expires_at: '2099-01-01T00:00:00Z',
  });
});

test('tries fallback URLs', async () => {
  configureApi({
    baseUrls: ['http://first', 'http://second'],
    getToken: async () => '',
  });
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error('first down'))
    .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '{}' });
  await getJson('/test');
  expect(global.fetch).toHaveBeenLastCalledWith('http://second/test', expect.any(Object));
});

type AssertKeys<T, K extends keyof T> = K;

// If backend adds/renames fields, these lines will fail to compile.
type _Me = AssertKeys<MeResponse, 'id' | 'email' | 'email_verified' | 'native_language' | 'target_language' | 'active_language' | 'ui_language'>;
type _LangOpts = AssertKeys<LanguageOptionsResponse, 'defaults' | 'allowed' | 'forced' | 'ui_defaults' | 'ui_forced'>;
type _Allowed = AssertKeys<AllowedLanguages, 'target_languages' | 'definition_languages' | 'ui_languages'>;

describe('DTO shape', () => {
  it('MeResponse includes active_language and ui_language', () => {
    const me: MeResponse = {
      id: 'u1',
      email: 'a@b.com',
      email_verified: true,
      native_language: 'ko',
      target_language: 'en',
      active_language: {
        user_id: 'u1',
        target_language: 'en',
        display_language: 'ko',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ui_language: 'ko',
    };
    expect(me.active_language.is_active).toBe(true);
  });

  it('AllowedLanguages includes target_languages, definition_languages, and ui_languages', () => {
    const allowed: AllowedLanguages = {
      target_languages: ['en', 'ko'],
      definition_languages: ['ko', 'en'],
      ui_languages: ['ko', 'en'],
    };
    expect(allowed.target_languages).toEqual(['en', 'ko']);
    expect(allowed.definition_languages).toEqual(['ko', 'en']);
    expect(allowed.ui_languages).toEqual(['ko', 'en']);
  });
});
