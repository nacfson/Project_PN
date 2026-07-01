import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { Confetti } from './Confetti';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('Confetti Component', () => {
  let dimensionsSpy: jest.SpyInstance;

  beforeAll(() => {
    dimensionsSpy = jest.spyOn(Dimensions, 'get').mockReturnValue({
      width: 375,
      height: 812,
      scale: 1,
      fontScale: 1,
    });
  });

  afterAll(() => {
    dimensionsSpy.mockRestore();
  });

  it('renders nothing when active is false', async () => {
    const { toJSON } = await render(
      <Confetti active={false} />,
      { wrapper: ThemeProvider }
    );
    expect(toJSON()).toBeNull();
  });

  it('renders particles when active is true', async () => {
    await render(
      <Confetti active={true} />,
      { wrapper: ThemeProvider }
    );
    expect(screen.getByTestId('confetti-container')).toBeTruthy();
    
    // Should render particles
    const particle = screen.getByTestId('confetti-particle-0');
    expect(particle).toBeTruthy();
  });
});
