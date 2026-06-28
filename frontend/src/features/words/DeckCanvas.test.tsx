import React, { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeckCanvas } from './DeckCanvas';
import { AppLanguageProvider } from '../../i18n';
import { ThemeProvider } from '../../theme/ThemeProvider';
import type { Deck } from '../../types';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <AppLanguageProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AppLanguageProvider>
  );
}

const decks: Deck[] = [
  { id: '1', name: 'Daily', item_count: 10, is_default: true, user_id: 'u1', target_language: 'en', created_at: '', updated_at: '' },
];

describe('DeckCanvas', () => {
  it('renders decks and create tile', async () => {
    await render(
      <DeckCanvas decks={decks} selectedId={null} onSelect={jest.fn()} onCreate={jest.fn()} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('New deck')).toBeTruthy();
  });

  it('calls onSelect when a deck is pressed', async () => {
    const onSelect = jest.fn();
    await render(
      <DeckCanvas decks={decks} selectedId={null} onSelect={onSelect} onCreate={jest.fn()} />,
      { wrapper: Wrapper },
    );
    fireEvent.press(screen.getByText('Daily'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });
});
