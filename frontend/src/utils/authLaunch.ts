import { Linking } from 'react-native';

export async function parseVerifiedEmailFromLaunchUrl(): Promise<string | null> {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (!initialUrl) {
      return null;
    }
    const url = new URL(initialUrl);
    if (url.searchParams.get('verified') === 'true') {
      return url.searchParams.get('email') ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
