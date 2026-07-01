import { configureApi } from '@project-pn/api';
import { sessionStorage } from './storage';
import { API_BASE_URLS } from '../config';

configureApi({
  baseUrls: API_BASE_URLS,
  getToken: () => sessionStorage.getToken(),
  onUnauthorized: () => {
    // Existing behavior: clear token and rely on app-level auth handling.
    sessionStorage.removeToken().catch((err) => {
      console.error('Failed to clear token on 401:', err);
    });
  },
});

export * from '@project-pn/api';
