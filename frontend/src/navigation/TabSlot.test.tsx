import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/ThemeProvider';
import { TabSlot } from './TabSlot';

it('keeps a long label inside the button', async () => {
  await render(
    <TabSlot
      label="SettingsSettingsSettings"
      focused
      onPress={() => {}}
      onLongPress={() => {}}
      testID="tab-settings"
      icon={null}
    />,
    { wrapper: ThemeProvider },
  );
  const label = screen.getByText('SettingsSettingsSettings');
  expect(label.props.numberOfLines).toBe(1);
  expect(label.props.ellipsizeMode).toBe('tail');
  expect(screen.getByTestId('tab-settings').props.style).toEqual(
    expect.objectContaining({ overflow: 'hidden', maxWidth: '100%' }),
  );
});
