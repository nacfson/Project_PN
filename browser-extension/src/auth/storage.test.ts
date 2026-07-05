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
  await extensionStorage.setToken('abc');
  expect(await extensionStorage.getToken()).toBe('abc');
  await extensionStorage.removeToken();
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
