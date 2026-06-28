import React, { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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
  it('renders unified add screen with deck selector and capture section', async () => {
    await render(<AddScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('All Words')).toBeTruthy();
    });

    expect(screen.getByPlaceholderText('Paste or type text here...')).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a word')).toBeTruthy();
    expect(screen.queryByText('Import')).toBeNull();
  });
});
