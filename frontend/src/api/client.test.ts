import type { ApiConfig } from '@project-pn/api';

describe('frontend api client __DEV__ browser URL token cache', () => {
  const originalWindow = global.window;

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalWindow === undefined) {
      delete (global as { window?: unknown }).window;
    } else {
      Object.defineProperty(global, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
    }
  });

  it('keeps returning cached __DEV__ launch URL token after SPA path navigation and clears on logout', async () => {
    let capturedConfig: ApiConfig | undefined;

    Object.defineProperty(global, 'window', {
      value: { location: { href: 'http://localhost:8081/?token=mock-dev-token' } },
      configurable: true,
      writable: true,
    });

    let clearDevUrlToken!: () => void;

    jest.isolateModules(() => {
      jest.doMock('@project-pn/api', () => ({
        configureApi: jest.fn((cfg: ApiConfig) => {
          capturedConfig = cfg;
        }),
      }));
      jest.doMock('../utils/platform', () => ({
        isBrowserWeb: () => true,
      }));
      jest.doMock('./sessionStorage', () => ({
        sessionStorage: {
          getToken: jest.fn().mockResolvedValue(null),
          getRefreshToken: jest.fn().mockResolvedValue(null),
          setSession: jest.fn(),
          clearSession: jest.fn().mockResolvedValue(undefined),
        },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const clientMod = require('./client') as { clearDevUrlToken: () => void };
      clearDevUrlToken = clientMod.clearDevUrlToken;
    });

    expect(capturedConfig?.authMode).toBe('bearer');
    await expect(capturedConfig?.getToken()).resolves.toBe('mock-dev-token');

    // Simulate React Navigation changing browser path without ?token=... query param.
    (global.window as unknown as { location: { href: string } }).location.href =
      'http://localhost:8081/add';
    await expect(capturedConfig?.getToken()).resolves.toBe('mock-dev-token');

    // Simulate logout/unauthorized clearing the in-memory token.
    clearDevUrlToken();
    await expect(capturedConfig?.getToken()).resolves.toBeNull();
  });
});
