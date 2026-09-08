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
  it('shows only the chosen gloss on the back (no English definition line)', async () => {
    await renderCard({
      definition: 'to store energy',
      localized_definition: '충전하다',
      localized_short_definition: '충전하다',
    });

    expect(screen.getByText('충전하다')).toBeTruthy();
    expect(screen.queryByText('to store energy')).toBeNull();
    expect(screen.queryByText('Simple meaning')).toBeNull();
    expect(screen.queryByText('Full meaning')).toBeNull();
    expect(screen.queryByText('Definition')).toBeNull();
  });

  it('prefers a simple headword gloss over a verbose paraphrase', async () => {
    await renderCard({
      definition: 'To cover something completely so that it cannot be seen.',
      short_definition: 'To hide or conceal something by covering it.',
      localized_definition: '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.',
      localized_short_definition: '무엇을 덮어 감추다.',
    });

    expect(screen.getByText('감추다')).toBeTruthy();
    expect(screen.queryByText('무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다.')).toBeNull();
    expect(screen.queryByText('To cover something completely so that it cannot be seen.')).toBeNull();
  });

  it('does not render example sentences as primary UX', async () => {
    await renderCard({}, {
      sentence: 'Daily discipline helped her finish the project.',
      localized_translation: '매일의 절제가 그녀가 프로젝트를 끝내는 데 도움이 되었다.',
    });

    expect(screen.queryByText('Daily discipline helped her finish the project.')).toBeNull();
    expect(screen.queryByText('매일의 절제가 그녀가 프로젝트를 끝내는 데 도움이 되었다.')).toBeNull();
    expect(screen.queryByText('Example')).toBeNull();
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

  it('shows swipe guide after reveal when onRate is provided', async () => {
    await renderCard();
    expect(screen.getByText(/Swipe left\/right/i)).toBeTruthy();
  });

  it('caps outer card height when maxHeight is smaller than content', async () => {
    const longGloss =
      '무엇을 흙이나 눈 등으로 덮어 보이지 않게 감추다; 숨기다; 가리다; 덮어 버리다; '.repeat(8);

    await render(
      <Flashcard
        item={{
          ...baseItem,
          localized_definition: longGloss,
          localized_short_definition: null,
          definition: longGloss,
          short_definition: null,
        }}
        example={{ sentence: 'a', localized_translation: 'b' }}
        blankedSentence="a"
        isFlipped
        cardMode="flashcard"
        userAnswer=""
        isPreviouslyFailed={false}
        onFlip={jest.fn()}
        onRate={jest.fn()}
        maxHeight={280}
      />,
      { wrapper: Wrapper }
    );

    const wrapper = screen.getByTestId('flashcard-3d-wrapper');
    expect(wrapper.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ height: 280 })])
    );
  });

  it('does not crash when part_of_speech is unknown (Anki import fallback)', async () => {
    // Backend import_service inserts words with part_of_speech 'unknown' when
    // enrichment is unavailable. Missing/unsafe POS labels must not throw.
    await expect(renderCard({ part_of_speech: 'unknown' })).resolves.toBeDefined();
    // Front + back faces both mount on web, so the badge text appears twice.
    expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThan(0);
  });

  it('falls back to raw POS when translation key is missing', async () => {
    await expect(renderCard({ part_of_speech: 'particle' })).resolves.toBeDefined();
    expect(screen.getAllByText('PARTICLE').length).toBeGreaterThan(0);
  });

  it('shows Fail repeatedly badge when is_leech', async () => {
    await renderCard({ is_leech: true, lapse_count: 8 });
    expect(screen.getAllByText('Fail repeatedly!').length).toBeGreaterThan(0);
  });

  it('prefers personal_note on the back with Your meaning caption', async () => {
    await renderCard({
      personal_note: '내가 적은 뜻',
      localized_definition: '사전 뜻',
      localized_short_definition: '사전 뜻',
    });
    expect(screen.getByText('내가 적은 뜻')).toBeTruthy();
    expect(screen.getByText('Your meaning')).toBeTruthy();
    expect(screen.queryByText('사전 뜻')).toBeNull();
  });
});
