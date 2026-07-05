import { configureApi } from '@project-pn/api';
import { extensionStorage } from '../auth/storage';

configureApi({
  baseUrls: [process.env.EXT_API_BASE_URL ?? 'http://localhost:8080'],
  getToken: () => extensionStorage.getToken(),
  onUnauthorized: () => extensionStorage.removeToken(),
});

export * from '@project-pn/api';
