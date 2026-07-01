import { Linking, Platform } from 'react-native';
import {
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

    it('returns null if token is not present', () => {
      expect(extractTokenFromUrl('http://localhost:8081/#/dashboard?foo=bar')).toBeNull();
    });

    it('returns null on invalid URLs', () => {
      expect(extractTokenFromUrl('')).toBeNull();
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

      it('extracts token, deletes it from URL query, and replaces history state', async () => {
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBe('abc_token');
        expect(mockReplaceState).toHaveBeenCalledWith(
          {},
          'Mock Title',
          '/'
        );
      });

      it('extracts token from hash query, deletes it, and replaces history state preserving other query parameters', async () => {
        (global as any).window.location.href = 'http://localhost:8081/#/dashboard?token=hash_token&foo=bar';
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBe('hash_token');
        expect(mockReplaceState).toHaveBeenCalledWith(
          {},
          'Mock Title',
          '/#/dashboard?foo=bar'
        );
      });

      it('returns null and does not replace state if no token is present', async () => {
        (global as any).window.location.href = 'http://localhost:8081/#/dashboard?foo=bar';
        const token = await parseTokenFromLaunchUrl();
        expect(token).toBeNull();
        expect(mockReplaceState).not.toHaveBeenCalled();
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
  });

  describe('parseVerifiedEmailFromLaunchUrl', () => {
    it('always returns null as a compatibility stub', async () => {
      const email = await parseVerifiedEmailFromLaunchUrl();
      expect(email).toBeNull();
    });
  });
});
