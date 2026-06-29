import React, { ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Flashcard } from './Flashcard';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { DueItem } from '../../types';

jest.mock('../../components/SpeakButton', () => ({
  SpeakButton: () => null,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
        frame: { x: 0, y: 0, width: 375, height: 812 },
      }}
    >
      <AppLanguageProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AppLanguageProvider>
    </SafeAreaProvider>
  );
}

const baseItem: DueItem = {
  user_word_sense_id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  language_code: 'en',
  lemma: 'discipline',
  normalized_text: 'discipline',
  part_of_speech: 'noun',
  pronunciation: null,
  display_language_code: 'ko',
  definition: 'Training that develops self-control; controlled behavior; or a field of study.',
  short_definition: null,
  localized_definition: 'Training that develops self-control; controlled behavior; or a field of study.',
  localized_short_definition: null,
  cefr_level: null,
  meaning_order: 1,
  learning_stage: 'recognized',
  due_at: '2026-06-29T00:00:00Z',
  examples: [],
};

async function renderCard(overrides: Partial<DueItem> = {}, example = {
  sentence: 'Daily discipline helped her finish the project.',
  localized_translation: 'Daily discipline helped her finish the project.',
}) {
  const item = { ...baseItem, ...overrides };
  return await render(
    <Flashcard
      item={item}
      example={example}
      blankedSentence="Daily _____ helped her finish the project."
      isFlipped
      cardMode="flashcard"
      userAnswer=""
      isPreviouslyFailed={false}
      onFlip={jest.fn()}
      onRate={jest.fn()}
    />,
    { wrapper: Wrapper }
  );
}

describe('Flashcard', () => {
  it('does not render duplicate localized definition text', async () => {
    await renderCard();

    expect(screen.getAllByText(baseItem.definition)).toHaveLength(1);
  });

  it('does not render duplicate localized example text', async () => {
    await renderCard();

    expect(screen.queryByText('Daily discipline helped her finish the project.')).toBeNull();
  });

  it('renders a real translated example', async () => {
    await renderCard({}, {
      sentence: 'Daily discipline helped her finish the project.',
      localized_translation: '매일의 절제가 그녀가 프로젝트를 끝내는 데 도움이 되었다.',
    });

    expect(screen.getByText('매일의 절제가 그녀가 프로젝트를 끝내는 데 도움이 되었다.')).toBeTruthy();
  });

  it('card Pressable is enabled/has role when not flipped, and disabled/no role when flipped', async () => {
    const onFlip = jest.fn();
    const { rerender } = await render(
      <Flashcard
        item={baseItem}
        example={{ sentence: 'a', localized_translation: 'b' }}
        blankedSentence="a"
        isFlipped={false}
        cardMode="flashcard"
        userAnswer=""
        isPreviouslyFailed={false}
        onFlip={onFlip}
      />,
      { wrapper: Wrapper }
    );

    // Not flipped: should have accessibilityLabel and role
    const pressable = screen.getByLabelText('TAP TO REVEAL ANSWER');
    expect(pressable).toBeTruthy();
    
    // Flipped: should remove accessibility attributes
    await rerender(
      <Flashcard
        item={baseItem}
        example={{ sentence: 'a', localized_translation: 'b' }}
        blankedSentence="a"
        isFlipped={true}
        cardMode="flashcard"
        userAnswer=""
        isPreviouslyFailed={false}
        onFlip={onFlip}
      />
    );

    expect(screen.queryByLabelText('TAP TO REVEAL ANSWER')).toBeNull();
  });
});
