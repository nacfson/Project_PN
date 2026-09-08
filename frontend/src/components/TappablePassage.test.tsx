import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TappablePassage } from './TappablePassage';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
}));

async function renderPassage(selected: Set<string>, onToggle: (word: string) => void) {
  return render(
    <AppLanguageProvider>
      <ThemeProvider>
        <TappablePassage text="look up later" selected={selected} onToggle={onToggle} />
      </ThemeProvider>
    </AppLanguageProvider>,
  );
}

describe('TappablePassage', () => {
  it('toggles a single word on first tap', async () => {
    const onToggle = jest.fn();
    await renderPassage(new Set(), onToggle);
    fireEvent.press(screen.getByText('look'));
    expect(onToggle).toHaveBeenCalledWith('look');
  });

  it('selects a multi-word phrase span when a second different word is tapped', async () => {
    const onToggle = jest.fn();
    await renderPassage(new Set(), onToggle);
    fireEvent.press(screen.getByText('look'));
    await waitFor(() => expect(onToggle).toHaveBeenCalledWith('look'));
    fireEvent.press(screen.getByText('up'));
    await waitFor(() => {
      expect(onToggle).toHaveBeenCalledWith('look up');
    });
  });
});
