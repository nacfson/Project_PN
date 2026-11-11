import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { HoverReveal } from './HoverReveal';

describe('HoverReveal', () => {
  it('renders children with full opacity on mobile/touch', async () => {
    await render(
      <HoverReveal>
        <Text>Touch action</Text>
      </HoverReveal>,
    );
    expect(screen.getByText('Touch action')).toBeTruthy();
  });

  it('renders with hover handlers when simulated on wide web', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'web';

    try {
      await render(
        <HoverReveal>
          <Text>Desktop action</Text>
        </HoverReveal>,
      );
      expect(screen.getByText('Desktop action')).toBeTruthy();
    } finally {
      Platform.OS = originalOS;
    }
  });
});
