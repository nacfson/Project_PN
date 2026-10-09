import { configureApi } from './client';
import { me, getLinkedProviders, getLanguageOptions } from './auth';

describe('Shared API client auth integration (001-gateway-jwt-auth)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('consistently attaches Bearer token for protected requests in bearer mode (non-web / native / token-based)', async () => {
    const testToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.jwt';
    configureApi({
      baseUrls: ['http://localhost:8080'],
      authMode: 'bearer',
      getToken: async () => testToken,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'user-1', email: 'test@example.com' }),
    });

    await me();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${testToken}`,
        }),
      })
    );
  });

  test('attaches Bearer token when accessing linked-providers', async () => {
    const testToken = 'token-for-providers';
    configureApi({
      baseUrls: ['http://localhost:8080'],
      authMode: 'bearer',
      getToken: async () => testToken,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ provider: 'google', email: 'user@example.com', linked_at: '2026-10-09T00:00:00Z' }]),
    });

    await getLinkedProviders();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/linked-providers',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${testToken}`,
        }),
      })
    );
  });

  test('omits Authorization header for explicitly unauthenticated requests', async () => {
    configureApi({
      baseUrls: ['http://localhost:8080'],
      authMode: 'bearer',
      getToken: async () => 'secret-bearer-token',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ defaults: { target_language: 'en', definition_language: 'ko' } }),
    });

    await getLanguageOptions();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/language-options',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.anything(),
        }),
      })
    );
  });
});
