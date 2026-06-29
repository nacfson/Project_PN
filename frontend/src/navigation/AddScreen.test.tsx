import React, { ReactNode } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { AddScreen } from './AddScreen';
import { AddQueueProvider } from '../hooks/useAddQueue';
import { AppLanguageProvider } from '../i18n';
import { ThemeProvider } from '../theme/ThemeProvider';

jest.mock('../api/decks', () => ({
  listDecks: jest.fn().mockResolvedValue([
    { id: 'd1', name: 'All Words', is_default: true, target_language: 'en', item_count: 10, user_id: 'u1', created_at: '', updated_at: '' },
  ]),
}));

jest.mock('../hooks/useActiveTargetLanguage', () => ({
  useActiveTargetLanguage: () => ({ targetLanguage: 'en', displayLanguage: 'ko', loading: false, error: null, refresh: jest.fn() }),
}));

jest.mock('../api/words', () => ({
  addLearningItem: jest.fn().mockResolvedValue(undefined),
  lookupWord: jest.fn().mockResolvedValue({ sense_options: [] }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>
        <AddQueueProvider>{children}</AddQueueProvider>
      </ThemeProvider>
    </AppLanguageProvider>
  );
}

describe('AddScreen', () => {
  it('renders segmented switcher and defaults to From Passage tab', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Segmented tab switchers should be present
    expect(screen.getAllByText('From a passage').length).toBeGreaterThan(0);
    expect(screen.getByText('Manual Add')).toBeTruthy();

    // Defaults to From Passage capture flow
    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    // Manual add section should not be visible
    expect(screen.queryByPlaceholderText('Type a word')).toBeNull();
  });

  it('switches to Manual Add tab when clicked', async () => {
    render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    // Click on Manual Add tab
    const manualTab = screen.getByTestId('tab-manual');
    fireEvent.press(manualTab);

    // Manual add section should be visible
    await waitFor(() => expect(screen.getByPlaceholderText('Type a word')).toBeTruthy());
    // Passage capture flow should not be visible
    expect(screen.queryByPlaceholderText('Paste or type text here...')).toBeNull();

    // Click back to From Passage tab
    const passageTab = screen.getByTestId('tab-passage');
    fireEvent.press(passageTab);

    // Passage capture flow should be visible again
    await waitFor(() => expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy());
    expect(screen.queryByPlaceholderText('Type a word')).toBeNull();
  });
});
