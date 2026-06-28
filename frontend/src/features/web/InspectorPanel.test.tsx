import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { InspectorPanel } from './InspectorPanel';

describe('InspectorPanel', () => {
  const wrapper = ThemeProvider;

  it('renders children when visible', async () => {
    await render(
      <InspectorPanel visible onClose={jest.fn()}>
        <Text>Inspector content</Text>
      </InspectorPanel>,
      { wrapper }
    );
    expect(screen.getByText('Inspector content')).toBeTruthy();
  });

  it('calls onClose when backdrop is pressed', async () => {
    const onClose = jest.fn();
    await render(
      <InspectorPanel visible onClose={onClose}>
        <Text>Content</Text>
      </InspectorPanel>,
      { wrapper }
    );
    fireEvent.press(screen.getByTestId('inspector-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
