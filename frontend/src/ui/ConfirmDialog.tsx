import React, { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { PAGE_WIDTH_FRAME } from '../navigation/shellKind';
import { radii, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const cancelWrapperRef = useRef<View>(null);

  useKeyboardShortcut('Escape', onCancel, {
    enabled: visible,
  });

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const node = cancelWrapperRef.current as unknown as {
      querySelector?: (sel: string) => HTMLElement | null;
      focus?: () => void;
    } | null;
    const button = node?.querySelector?.('button, [role="button"]');
    if (button && typeof button.focus === 'function') {
      button.focus();
    } else if (node && typeof node.focus === 'function') {
      node.focus();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable
          testID="confirm-dialog-backdrop"
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={onCancel}
        />
        <View
          testID="confirm-dialog"
          accessibilityRole="alert"
          style={[styles.dialogFrame, PAGE_WIDTH_FRAME]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.hairline,
              },
            ]}
          >
            <Text variant="sectionTitle" style={styles.title}>
              {title}
            </Text>
            <Text variant="body" color={colors.textSecondary} style={styles.body}>
              {body}
            </Text>
            <View style={styles.actions}>
              <View ref={cancelWrapperRef}>
                <Button
                  testID="confirm-dialog-cancel"
                  label={cancelLabel}
                  variant="secondary"
                  size="md"
                  onPress={onCancel}
                />
              </View>
              <Button
                testID="confirm-dialog-confirm"
                label={confirmLabel}
                variant={tone === 'danger' ? 'danger' : 'primary'}
                size="md"
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  dialogFrame: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    marginBottom: 2,
  },
  body: {
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
