import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsGroup, SettingsRow } from './SettingsGroup';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('SettingsGroup / SettingsRow', () => {
  it('renders standard inline row with title, subtitle, and trailing', async () => {
    const { getByText, getByTestId } = await render(
      <SettingsGroup title="General">
        <SettingsRow
          testID="row-test"
          title="Account"
          subtitle="Manage details"
          trailing={<View testID="trailing-node" />}
        />
      </SettingsGroup>,
      { wrapper: ThemeProvider },
    );

    expect(getByText('General')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Manage details')).toBeTruthy();
    expect(getByTestId('trailing-node')).toBeTruthy();

    const row = getByTestId('row-test');
    const flatStyle = StyleSheet.flatten(row.props.style);
    expect(flatStyle.flexDirection).toBe('row');
  });

  it('renders stacked row with column layout when stacked=true', async () => {
    const { getByTestId } = await render(
      <SettingsGroup>
        <SettingsRow
          testID="row-stacked"
          title="Daily Goal"
          subtitle="Select XP"
          stacked
          trailing={<View testID="trailing-stacked" />}
        />
      </SettingsGroup>,
      { wrapper: ThemeProvider },
    );

    const row = getByTestId('row-stacked');
    const flatStyle = StyleSheet.flatten(row.props.style);
    expect(flatStyle.flexDirection).toBe('column');
    expect(flatStyle.alignItems).toBe('stretch');
  });
});
