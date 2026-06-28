import React, { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TargetDeckSelector } from './TargetDeckSelector';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

const decks = [
  { id: 'd1', name: 'All Words', is_default: true, target_language: 'en', item_count: 10, user_id: 'u1', created_at: '', updated_at: '' },
  { id: 'd2', name: 'Travel', is_default: false, target_language: 'en', item_count: 5, user_id: 'u1', created_at: '', updated_at: '' },
];

describe('TargetDeckSelector', () => {
  it('renders selected deck and opens dropdown on tap', async () => {
    const onSelect = jest.fn();
    await render(<TargetDeckSelector decks={decks} selectedId="d1" onSelect={onSelect} />, { wrapper: Wrapper });

    expect(screen.getByText('All Words')).toBeTruthy();
    fireEvent.press(screen.getByText('All Words'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search decks')).toBeTruthy();
      expect(screen.getByText('Travel')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Travel'));
    expect(onSelect).toHaveBeenCalledWith('d2');
  });
});
