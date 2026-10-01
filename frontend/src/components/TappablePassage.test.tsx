import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TappablePassage, type PassageSpan } from './TappablePassage';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true],
  Inter_400Regular: 'Inter_400Regular',
  Inter_500Medium: 'Inter_500Medium',
  Inter_600SemiBold: 'Inter_600SemiBold',
  Inter_700Bold: 'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
}));

function renderPassage(props: {
  phraseMode?: boolean;
  phraseAnchor?: number | null;
  selected?: PassageSpan[];
  onToggleSpan: (span: PassageSpan) => void;
  onPhraseAnchor?: (wordIndex: number | null) => void;
}) {
  return render(
    <AppLanguageProvider>
      <ThemeProvider>
        <TappablePassage
          text="look up later"
          selected={props.selected ?? []}
          phraseMode={props.phraseMode}
          phraseAnchor={props.phraseAnchor ?? null}
          onToggleSpan={props.onToggleSpan}
          onPhraseAnchor={props.onPhraseAnchor ?? jest.fn()}
        />
      </ThemeProvider>
    </AppLanguageProvider>,
  );
}

describe('TappablePassage', () => {
  it('selects a single word when phrase mode is off', () => {
    const onToggleSpan = jest.fn();
    renderPassage({ onToggleSpan });
    fireEvent.press(screen.getByTestId('passage-word-0'));
    expect(onToggleSpan).toHaveBeenCalledWith({ start: 0, end: 0, text: 'look' });
  });

  it('selects a multi-word phrase span in phrase mode', () => {
    const onToggleSpan = jest.fn();
    const onPhraseAnchor = jest.fn();
    const { rerender } = render(
      <AppLanguageProvider>
        <ThemeProvider>
          <TappablePassage
            text="look up later"
            selected={[]}
            phraseMode
            phraseAnchor={null}
            onToggleSpan={onToggleSpan}
            onPhraseAnchor={onPhraseAnchor}
          />
        </ThemeProvider>
      </AppLanguageProvider>,
    );
    fireEvent.press(screen.getByTestId('passage-word-0'));
    expect(onPhraseAnchor).toHaveBeenCalledWith(0);
    expect(onToggleSpan).not.toHaveBeenCalled();

    rerender(
      <AppLanguageProvider>
        <ThemeProvider>
          <TappablePassage
            text="look up later"
            selected={[]}
            phraseMode
            phraseAnchor={0}
            onToggleSpan={onToggleSpan}
            onPhraseAnchor={onPhraseAnchor}
          />
        </ThemeProvider>
      </AppLanguageProvider>,
    );
    fireEvent.press(screen.getByTestId('passage-word-1'));
    expect(onToggleSpan).toHaveBeenCalledWith({ start: 0, end: 1, text: 'look up' });
  });
});
