import { getPathFromState, getStateFromPath } from '@react-navigation/core';
import type { PartialState, NavigationState } from '@react-navigation/native';
import { linkingConfig } from './linkingConfig';

function focusedRoute(path: string): string | undefined {
  let state: PartialState<NavigationState> | undefined = getStateFromPath(path, linkingConfig);
  if (!state?.routes?.length) return undefined;
  let route = state.routes[state.index ?? 0];
  while (route.state?.routes?.length) {
    const nested = route.state;
    route = nested.routes[nested.index ?? 0];
  }
  return route.name;
}

describe('web linking', () => {
  it('opens Learn for a fresh tab at /', () => {
    expect(focusedRoute('/')).toBe('Learn');
    expect(focusedRoute('/?code=pickup')).toBe('Learn');
    expect(focusedRoute('/learn')).toBe('Learn');
  });

  it('keeps settings off the site root', () => {
    expect(focusedRoute('/settings')).toBe('SettingsRoot');
    expect(focusedRoute('/connected-accounts')).toBe('ConnectedAccounts');
    expect(
      getPathFromState(
        {
          index: 1,
          routes: [
            { name: 'Learn' },
            { name: 'Settings', state: { index: 0, routes: [{ name: 'SettingsRoot' }] } },
          ],
        },
        linkingConfig,
      ),
    ).toBe('/settings');
  });
});
