import { configureApi } from '@project-pn/api';
import { extensionStorage } from '../auth/storage';

configureApi({
  baseUrls: [process.env.EXT_API_BASE_URL ?? 'http://localhost:8080'],
  getToken: () => extensionStorage.getToken(),
  getRefreshToken: () => extensionStorage.getRefreshToken(),
  onSessionRefreshed: (session) => extensionStorage.setSession(session),
  onUnauthorized: () => extensionStorage.clearSession(),
});

export * from '@project-pn/api';
