import { Linking, Platform } from 'react-native';
import {
  extractSessionFromUrl,
  extractTokenFromUrl,
  parseTokenFromLaunchUrl,
  parseVerifiedEmailFromLaunchUrl,
} from './authLaunch';

describe('authLaunch utils', () => {
  const originalPlatformOS = Platform.OS;
  const originalWindow = global.window;
  const originalDocument = (global as any).document;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    if (originalWindow === undefined) {
      delete (global as any).window;
    } else {
      (global as any).window = originalWindow;
    }
    if (originalDocument === undefined) {
      delete (global as any).document;
    } else {
      (global as any).document = originalDocument;
    }
  });

  describe('extractTokenFromUrl', () => {
    it('extracts token from standard URL query param', () => {
      expect(extractTokenFromUrl('http://localhost:8081/?token=abc_token')).toBe('abc_token');
    });

    it('extracts token from URL with multiple parameters', () => {
      expect(extractTokenFromUrl('http://localhost:8081/?foo=bar&token=xyz_token&baz=123')).toBe('xyz_token');
    });

    it('extracts token from URL with hash fragment path and query param', () => {
      expect(extractTokenFromUrl('projectpn://auth?token=xyz_token#welcome')).toBe('xyz_token');
    });

    it('extracts token when it is located in the hash fragment', () => {
      expect(extractTokenFromUrl('http://localhost:8081/#/dashboard?token=xyz_token')).toBe('xyz_token');
    });

    it('extracts #token= from raw hash fragment (auth server style)', () => {
      expect(extractTokenFromUrl('projectpn://auth#token=hash_raw_token')).toBe('hash_raw_token');
    });

    it('returns null if token is not present', () => {
      expect(extractTokenFromUrl('http://localhost:8081/#/dashboard?foo=bar')).toBeNull();
    });

    it('returns null on invalid URLs', () => {
      expect(extractTokenFromUrl('')).toBeNull();
    });
  });

  describe('extractSessionFromUrl', () => {
    it('extracts full session from redirect URL', () => {
      expect(
        extractSessionFromUrl(
          'projectpn://auth?token=access&refresh_token=refresh&expires_at=2026-12-01T00:00:00Z',
        ),
      ).toEqual({
        token: 'access',
        refresh_token: 'refresh',
        expires_at: '2026-12-01T00:00:00Z',
      });
    });

    it('falls back refresh token to access token when missing', () => {
      expect(extractSessionFromUrl('projectpn://auth?token=access')).toEqual({
        token: 'access',
        refresh_token: 'access',
        expires_at: expect.any(String),
      });
    });
  });

  describe('parseTokenFromLaunchUrl', () => {
    describe('Web platform', () => {
      let mockReplaceState: jest.Mock;

      beforeEach(() => {
        Platform.OS = 'web';
        mockReplaceState = jest.fn();
        
        Object.defineProperty(global, 'document', {
          value: {
            title: 'Mock Title',
          },
          writable: true,
          configurable: true,
        });

        Object.defineProperty(global, 'window', {
          value: {
            location: {
              href: 'http://localhost:8081/?token=abc_token',
            },
            history: {
              replaceState: mockReplaceState,
            },
          },
          writable: true,
          configurable: true,
        });
      });

      it('does not read or remove tokens from browser URLs', async () => {
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBeNull();
        expect(mockReplaceState).not.toHaveBeenCalled();
      });

      it('leaves hash URLs untouched for cookie SSO', async () => {
        (global as any).window.location.href = 'http://localhost:8081/#/dashboard?token=hash_token&foo=bar';
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBeNull();
        expect(mockReplaceState).not.toHaveBeenCalled();
      });

      it('returns null and does not replace state if no token is present', async () => {
        (global as any).window.location.href = 'http://localhost:8081/#/dashboard?foo=bar';
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBeNull();
        expect(mockReplaceState).not.toHaveBeenCalled();
      });

      it('exchanges ?code= pickup code via POST /api/auth/session and scrubs URL via history.replaceState', async () => {
        const pickupCode = '0123456789abcdef0123456789abcdef';
        (global as any).window.location = {
          href: `https://pn.nacfson.cloud/?code=${pickupCode}&keep=1#study`,
          search: `?code=${pickupCode}&keep=1`,
          pathname: '/',
          hash: '#study',
        };
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            token: 'v1.sealed-session-handle',
            refresh_token: 'v1.sealed-session-handle',
            expires_at: '2026-10-16T00:00:00Z',
          }),
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch as any;

        try {
          const token = await parseTokenFromLaunchUrl();
          expect(token).toBe('v1.sealed-session-handle');
          expect(mockReplaceState).toHaveBeenCalledWith({}, 'Mock Title', '/?keep=1#study');
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/session'),
            expect.objectContaining({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: pickupCode }),
            }),
          );
        } finally {
          global.fetch = originalFetch;
        }
      });

      it('returns null after scrubbing URL when POST /api/auth/session returns 401', async () => {
        const pickupCode = 'fedcba9876543210fedcba9876543210';
        (global as any).window.location = {
          href: `https://pn.nacfson.cloud/?code=${pickupCode}`,
          search: `?code=${pickupCode}`,
          pathname: '/',
          hash: '',
        };
        const mockFetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 401,
        });
        const originalFetch = global.fetch;
        global.fetch = mockFetch as any;

        try {
          const token = await parseTokenFromLaunchUrl();
          expect(token).toBeNull();
          expect(mockReplaceState).toHaveBeenCalledWith({}, 'Mock Title', '/');
        } finally {
          global.fetch = originalFetch;
        }
      });
    });

    describe('Native platforms', () => {
      beforeEach(() => {
        Platform.OS = 'ios';
        delete (global as any).window;
      });

      it('extracts token from Linking.getInitialURL() on success', async () => {
        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('projectpn://auth?token=native_token#welcome');
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBe('native_token');
      });

      it('returns null if Linking.getInitialURL() returns null', async () => {
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBeNull();
      });
    });

    describe('Tauri desktop', () => {
      beforeEach(() => {
        Platform.OS = 'web';
        Object.defineProperty(global, 'window', {
          value: { __TAURI__: {} },
          writable: true,
          configurable: true,
        });
      });

      it('keeps the native bearer deep-link flow', async () => {
        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('projectpn://auth?token=tauri_token');
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBe('tauri_token');
      });
    });
  });

  describe('parseVerifiedEmailFromLaunchUrl', () => {
    it('always returns null as a compatibility stub', async () => {
      const email = await parseVerifiedEmailFromLaunchUrl();
      expect(email).toBeNull();
    });
  });
});
