import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  clearLastDeckCacheForTest,
  getLastDeckId,
  getLastDeckIdSync,
  setLastDeckId,
} from './lastDeck';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('lastDeck storage', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    clearLastDeckCacheForTest();
    jest.clearAllMocks();
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  describe('on native (SecureStore)', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('returns null when no deck was stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      const result = await getLastDeckId('en');
      expect(result).toBeNull();
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('project_pn_last_deck_en');
    });

    it('stores and retrieves last deck id', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('deck-abc');
      await setLastDeckId('deck-abc', 'en');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('project_pn_last_deck_en', 'deck-abc');

      const result = await getLastDeckId('en');
      expect(result).toBe('deck-abc');
      expect(getLastDeckIdSync('en')).toBe('deck-abc');
    });

    it('partitions deck by target language', async () => {
      await setLastDeckId('deck-en-1', 'en');
      await setLastDeckId('deck-ko-1', 'ko');

      expect(getLastDeckIdSync('en')).toBe('deck-en-1');
      expect(getLastDeckIdSync('ko')).toBe('deck-ko-1');
    });
  });

  describe('on web (localStorage)', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      Platform.OS = 'web';
      mockStorage = {};
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: jest.fn((k: string) => mockStorage[k] ?? null),
          setItem: jest.fn((k: string, v: string) => {
            mockStorage[k] = v;
          }),
        },
        writable: true,
        configurable: true,
      });
    });

    it('stores and retrieves from localStorage', async () => {
      await setLastDeckId('deck-web-1', 'es');
      expect(localStorage.setItem).toHaveBeenCalledWith('project_pn_last_deck_es', 'deck-web-1');

      const result = await getLastDeckId('es');
      expect(result).toBe('deck-web-1');
      expect(getLastDeckIdSync('es')).toBe('deck-web-1');
    });
  });
});
