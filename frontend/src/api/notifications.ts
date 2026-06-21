import { getJson, postJson } from './client';

export interface RegisterPushTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export function registerPushToken(body: RegisterPushTokenRequest): Promise<{ registered: boolean }> {
  return postJson<{ registered: boolean }>('/api/notifications/register', body);
}
