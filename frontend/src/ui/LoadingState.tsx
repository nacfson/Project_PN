import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { Text } from './Text';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <Text color={colors.textSecondary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
});
