import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from '../api/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function resolvePushToken(): Promise<{ token: string; platform: 'ios' | 'android' | 'web' } | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync();
  const token = tokenResult.data;
  if (!token) {
    return null;
  }

  return {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };
}

/** Registers the device push token with the backend when running on a physical device. */
export function usePushNotifications(enabled: boolean): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || registeredRef.current) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const resolved = await resolvePushToken();
        if (!active || !resolved) {
          return;
        }
        await registerPushToken(resolved);
        registeredRef.current = true;
      } catch (err) {
        console.warn('Push notification registration failed:', err);
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled]);
}
