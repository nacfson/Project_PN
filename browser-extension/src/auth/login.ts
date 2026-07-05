import { extensionStorage } from './storage';

const LOGIN_URL = 'https://app.projectpn.com/login?extension=1';
const LOCAL_LOGIN_URL = 'http://localhost:8081/login?extension=1';
const ALLOWED_ORIGINS = ['https://app.projectpn.com', 'http://localhost:8081'];

export function openLoginWindow(): void {
  const isDev = process.env.EXT_API_BASE_URL?.includes('localhost') ?? true;
  const url = isDev ? LOCAL_LOGIN_URL : LOGIN_URL;
  chrome.windows.create({ url, type: 'popup', width: 420, height: 560 });
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!sender.origin || !ALLOWED_ORIGINS.includes(sender.origin)) {
    console.error('Unauthorized sender origin:', sender.origin);
    return;
  }
  if (message?.token && typeof message.token === 'string') {
    extensionStorage.setToken(message.token).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});
