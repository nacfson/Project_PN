import { extensionStorage } from './storage';

const store: Record<string, unknown> = {};

(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  storage: {
    local: {
      get: (key: string, cb: (r: Record<string, unknown>) => void) => cb({ [key]: store[key] }),
      set: (items: Record<string, unknown>, cb: () => void) => {
        Object.assign(store, items);
        cb();
      },
      remove: (key: string, cb: () => void) => {
        delete store[key];
        cb();
      },
    },
  },
} as unknown as typeof chrome;

test('token round-trip', async () => {
  await extensionStorage.setSession({
    token: 'abc',
    refresh_token: 'refresh-abc',
    expires_at: '2099-01-01T00:00:00Z',
  });
  expect(await extensionStorage.getToken()).toBe('abc');
  expect(await extensionStorage.getRefreshToken()).toBe('refresh-abc');
  expect(await extensionStorage.getExpiresAt()).toBe('2099-01-01T00:00:00Z');
  await extensionStorage.clearSession();
  expect(await extensionStorage.getToken()).toBeNull();
});

test('default deck round-trip', async () => {
  await extensionStorage.setDefaultDeckId('deck-1');
  expect(await extensionStorage.getDefaultDeckId()).toBe('deck-1');
});

test('language round-trip', async () => {
  await extensionStorage.setTargetLanguage('en');
  await extensionStorage.setDisplayLanguage('ko');
  expect(await extensionStorage.getTargetLanguage()).toBe('en');
  expect(await extensionStorage.getDisplayLanguage()).toBe('ko');
});
