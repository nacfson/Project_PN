const TOKEN_KEY = 'pn_token';
const DEFAULT_DECK_KEY = 'pn_default_deck_id';
const TARGET_LANGUAGE_KEY = 'pn_target_language';
const DISPLAY_LANGUAGE_KEY = 'pn_display_language';

function get<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null);
    });
  });
}

function set<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

function remove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => {
      resolve();
    });
  });
}

export const extensionStorage = {
  getToken: () => get<string>(TOKEN_KEY),
  setToken: (token: string) => set(TOKEN_KEY, token),
  removeToken: () => remove(TOKEN_KEY),

  getDefaultDeckId: () => get<string>(DEFAULT_DECK_KEY),
  setDefaultDeckId: (id: string) => set(DEFAULT_DECK_KEY, id),

  getTargetLanguage: () => get<string>(TARGET_LANGUAGE_KEY),
  setTargetLanguage: (code: string) => set(TARGET_LANGUAGE_KEY, code),

  getDisplayLanguage: () => get<string>(DISPLAY_LANGUAGE_KEY),
  setDisplayLanguage: (code: string) => set(DISPLAY_LANGUAGE_KEY, code),
};
