import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CentralAuthScreen } from './CentralAuthScreen';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('CentralAuthScreen', () => {
  it('renders the central redirect buttons', async () => {
    await render(<CentralAuthScreen />, { wrapper: ThemeProvider });
    expect(screen.getByText('Sign In with Nacfson Cloud')).toBeTruthy();
  });
});
