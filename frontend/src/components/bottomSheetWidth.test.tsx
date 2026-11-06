import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { lookupWord } from '../api/words';
import { ChangeMeaningSheet } from '../features/words/ChangeMeaningSheet';
import { DeckFilterMenu } from '../features/words/DeckFilterMenu';
import { DeckFormModal } from '../features/words/DeckFormModal';
import { MoveToDeckModal } from '../features/words/MoveToDeckModal';
import { AppLanguageProvider } from '../i18n';
import { BROWSER_PAGE_MAX_WIDTH } from '../navigation/shellKind';
import { ThemeProvider } from '../theme/ThemeProvider';
import type { LearningItemListItem } from '../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SensePicker } from './SensePicker';

jest.mock('../api/words', () => ({
  lookupWord: jest.fn(),
  changeLearningItemSense: jest.fn(),
  setLearningItemPersonalNote: jest.fn(),
}));

const item = {
  id: 'uws-1',
  word_sense_id: 'ws-1',
  word_id: 'w-1',
  lemma: 'charge',
  examples: [],
} as unknown as LearningItemListItem;

const sheets: [string, React.ReactElement, string?][] = [
  [
    'SensePicker',
    <SensePicker
      key="sense"
      visible
      query="charge"
      options={[]}
      onConfirm={jest.fn()}
      onForceExisting={jest.fn()}
      onForceWithPos={jest.fn()}
      onClose={jest.fn()}
    />,
  ],
  [
    'ChangeMeaningSheet',
    <ChangeMeaningSheet key="change" visible item={item} onClose={jest.fn()} onChanged={jest.fn()} />,
  ],
  ['DeckFormModal', <DeckFormModal key="deck" visible mode="create" onClose={jest.fn()} onSubmit={jest.fn()} />],
  ['MoveToDeckModal', <MoveToDeckModal key="move" visible decks={[]} onClose={jest.fn()} onSelect={jest.fn()} />],
  [
    'DeckFilterMenu',
    <DeckFilterMenu
      key="deck-filter"
      defaultOpen
      decks={[]}
      selectedDeckId={null}
      onSelectDeck={jest.fn()}
      onNewDeck={jest.fn()}
      onManageDecks={jest.fn()}
    />,
  ],
  [
    'ConfirmDialog',
    <ConfirmDialog
      key="confirm"
      visible
      title="Remove this word?"
      body="This can't be undone."
      confirmLabel="Remove"
      cancelLabel="Cancel"
      tone="danger"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
    'confirm-dialog',
  ],
];

// DESIGN.md: overlays stay within the main UI's width.
describe.each(sheets)('%s', (_name, sheet, testId = 'bottom-sheet') => {
  beforeEach(() => {
    (lookupWord as jest.Mock).mockResolvedValue({ sense_options: [] });
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
    });
    await cleanup();
  });

  it('caps its width to the main page and centers on it', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
          frame: { x: 0, y: 0, width: 375, height: 812 },
        }}
      >
        <AppLanguageProvider>
          <ThemeProvider>{sheet}</ThemeProvider>
        </AppLanguageProvider>
      </SafeAreaProvider>,
    );

    expect(StyleSheet.flatten(screen.getByTestId(testId).props.style)).toEqual(
      expect.objectContaining({ width: '100%', maxWidth: BROWSER_PAGE_MAX_WIDTH, alignSelf: 'center' }),
    );
  });
});
