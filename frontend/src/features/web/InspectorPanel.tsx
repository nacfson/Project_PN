import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { Icon } from '../../ui';

interface InspectorPanelProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function InspectorPanel({ visible, onClose, children, title }: InspectorPanelProps) {
  const { colors, spacing, radii, shadows } = useTheme();
  const reduced = useReducedMotion();
  const translateX = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : 300,
        duration: reduced ? 0 : 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: reduced ? 0 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, reduced, translateX, opacity]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable
          testID="inspector-backdrop"
          onPress={onClose}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.25)',
            opacity,
          }}
        />
        <Animated.View
          style={{
            width: 360,
            maxWidth: '80%',
            height: '100%',
            backgroundColor: colors.surface,
            borderLeftWidth: 1,
            borderLeftColor: colors.outlineVariant,
            padding: spacing.lg,
            paddingTop: spacing.xxl,
            ...shadows.lg,
            transform: [{ translateX }],
          }}
        >
          <Pressable
            onPress={onClose}
            style={{
              position: 'absolute',
              top: spacing.lg,
              right: spacing.lg,
              padding: spacing.sm,
            }}
            accessibilityRole="button"
            accessibilityLabel="Close inspector"
          >
            <Icon name="close" size="md" />
          </Pressable>
          {title ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>{title}</Text>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
