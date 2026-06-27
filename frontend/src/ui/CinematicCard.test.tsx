import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { CinematicCard } from './CinematicCard';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('CinematicCard', () => {
  it('renders children', async () => {
    await render(
      <CinematicCard>
        <Text>Card body</Text>
      </CinematicCard>,
      { wrapper: ThemeProvider },
    );
    expect(screen.getByText('Card body')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(
      <CinematicCard onPress={onPress}>
        <Text>Press me</Text>
      </CinematicCard>,
      { wrapper: ThemeProvider },
    );
    fireEvent.press(screen.getByText('Press me'));
    expect(onPress).toHaveBeenCalled();
  });
});
