import React from 'react';
import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { visualVariations } from './tokens';

const mockGetMode = jest.fn(async (): Promise<'light' | 'dark' | null> => null);
const mockSetMode = jest.fn(async (_mode: 'light' | 'dark') => undefined);
const mockGetVariation = jest.fn(async (): Promise<string | null> => null);
const mockSetVariation = jest.fn(async (_variation: string) => undefined);

jest.mock('../api/storage', () => ({
  themeModeStorage: {
    getMode: () => mockGetMode(),
    setMode: (mode: 'light' | 'dark') => mockSetMode(mode),
  },
  themeVariationStorage: {
    getVariation: () => mockGetVariation(),
    setVariation: (variation: string) => mockSetVariation(variation),
  },
}));

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
}));

import { ThemeProvider, useTheme } from './ThemeProvider';

function ThemeProbe() {
  const { mode, variation, colors, setMode, toggleMode, setVariation } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="variation">{variation}</Text>
      <Text testID="background">{colors.background}</Text>
      <Pressable testID="set-light" onPress={() => setMode('light')} />
      <Pressable testID="set-dark" onPress={() => setMode('dark')} />
      <Pressable testID="toggle" onPress={() => toggleMode()} />
      <Pressable testID="set-sunset" onPress={() => setVariation('bentoSunset')} />
      <Pressable testID="set-light-var" onPress={() => setVariation('bentoLight')} />
      <Pressable testID="set-indigo" onPress={() => setVariation('bentoIndigo')} />
    </>
  );
}

async function renderTheme() {
  const result = render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
  await waitFor(() => {
    expect(screen.getByTestId('mode')).toBeTruthy();
  });
  // Flush hydration Promise.all
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

describe('ThemeProvider mode/variation sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMode.mockResolvedValue(null);
    mockGetVariation.mockResolvedValue(null);
  });

  it('defaults to bentoIndigo dark palette', async () => {
    await renderTheme();

    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(screen.getByTestId('variation').props.children).toBe('bentoIndigo');
    expect(screen.getByTestId('background').props.children).toBe(
      visualVariations.bentoIndigo.background,
    );
  });

  it('setMode(light) switches to bentoLight and light background', async () => {
    await renderTheme();

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-light'));
    });

    expect(screen.getByTestId('mode').props.children).toBe('light');
    expect(screen.getByTestId('variation').props.children).toBe('bentoLight');
    expect(screen.getByTestId('background').props.children).toBe(
      visualVariations.bentoLight.background,
    );
    expect(mockSetMode).toHaveBeenCalledWith('light');
    expect(mockSetVariation).toHaveBeenCalledWith('bentoLight');
  });

  it('setMode(dark) from light restores bentoIndigo by default', async () => {
    await renderTheme();

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-light'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('set-dark'));
    });

    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(screen.getByTestId('variation').props.children).toBe('bentoIndigo');
    expect(screen.getByTestId('background').props.children).toBe(
      visualVariations.bentoIndigo.background,
    );
  });

  it('setVariation(bentoSunset) syncs mode to dark', async () => {
    await renderTheme();

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-sunset'));
    });

    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(screen.getByTestId('variation').props.children).toBe('bentoSunset');
    expect(screen.getByTestId('background').props.children).toBe(
      visualVariations.bentoSunset.background,
    );
    expect(mockSetMode).toHaveBeenCalledWith('dark');
    expect(mockSetVariation).toHaveBeenCalledWith('bentoSunset');
  });

  it('setVariation(bentoLight) syncs mode to light', async () => {
    await renderTheme();

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-light-var'));
    });

    expect(screen.getByTestId('mode').props.children).toBe('light');
    expect(screen.getByTestId('variation').props.children).toBe('bentoLight');
  });

  it('toggleMode light→dark restores last dark variation (sunset)', async () => {
    await renderTheme();

    await act(async () => {
      fireEvent.press(screen.getByTestId('set-sunset'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('toggle'));
    });
    expect(screen.getByTestId('variation').props.children).toBe('bentoLight');

    await act(async () => {
      fireEvent.press(screen.getByTestId('toggle'));
    });

    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(screen.getByTestId('variation').props.children).toBe('bentoSunset');
    expect(screen.getByTestId('background').props.children).toBe(
      visualVariations.bentoSunset.background,
    );
  });

  it('hydrates from stored variation and rewrites mismatched mode', async () => {
    mockGetMode.mockResolvedValue('light');
    mockGetVariation.mockResolvedValue('bentoSunset');

    await renderTheme();

    expect(screen.getByTestId('variation').props.children).toBe('bentoSunset');
    expect(screen.getByTestId('mode').props.children).toBe('dark');
    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });
});
