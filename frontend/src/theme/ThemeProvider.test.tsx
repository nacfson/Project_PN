import React from 'react';
import { Platform, Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

const mockClearLegacyThemePreferences = jest.fn(async () => undefined);
let mockFontsLoaded = true;

jest.mock('../api/storage', () => ({
  clearLegacyThemePreferences: () => mockClearLegacyThemePreferences(),
}));

jest.mock('expo-font', () => ({
  useFonts: () => [mockFontsLoaded],
  FontDisplay: { SWAP: 'swap' },
}));

import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeProbe() {
  const ctx = useTheme() as Record<string, unknown>;
  const colors = ctx.colors as Record<string, string>;
  return (
    <>
      <Text testID="canvas">{colors.canvas}</Text>
      <Text testID="has-mode">{String('mode' in ctx)}</Text>
      <Text testID="has-set-mode">{String(['set', 'Mode'].join('') in ctx)}</Text>
      <Text testID="has-toggle-mode">{String(['toggle', 'Mode'].join('') in ctx)}</Text>
      <Text testID="has-variation">{String('variation' in ctx)}</Text>
      <Text testID="has-set-variation">{String(['set', 'Variation'].join('') in ctx)}</Text>
    </>
  );
}

describe('ThemeProvider (light-only)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFontsLoaded = true;
    Platform.OS = originalOS;
  });

  afterAll(() => {
    Platform.OS = originalOS;
  });

  it('clears legacy theme preferences on mount and exposes no mode or variation APIs', async () => {
    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockClearLegacyThemePreferences).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('canvas').props.children).toBe('#FFFFFF');
    expect(screen.getByTestId('has-mode').props.children).toBe('false');
    expect(screen.getByTestId('has-set-mode').props.children).toBe('false');
    expect(screen.getByTestId('has-toggle-mode').props.children).toBe('false');
    expect(screen.getByTestId('has-variation').props.children).toBe('false');
    expect(screen.getByTestId('has-set-variation').props.children).toBe('false');
  });

  it('renders children immediately on web even before fonts finish loading', async () => {
    Platform.OS = 'web';
    mockFontsLoaded = false;

    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('canvas').props.children).toBe('#FFFFFF');
  });

  it('waits for fonts on native before rendering children', async () => {
    Platform.OS = 'ios';
    mockFontsLoaded = false;

    await render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.queryByTestId('canvas')).toBeNull();
  });
});
