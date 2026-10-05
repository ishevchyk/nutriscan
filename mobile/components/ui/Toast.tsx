import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useToastStore } from '../../store/toastStore';

// Default bottom tab bar height (excluding the safe-area inset); the toast sits above it.
const TAB_BAR_HEIGHT = 49;

/** Single global toast, mounted once in app/_layout.tsx. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismissToast = useToastStore((s) => s.dismissToast);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => dismissToast(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[styles.toast, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.md, opacity }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {toast.message}
      </Text>
      {toast.actionLabel && (
        <Pressable
          style={styles.action}
          hitSlop={4}
          onPress={() => {
            dismissToast(toast.id);
            toast.onAction?.();
          }}
        >
          <Text style={styles.actionText}>{toast.actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute',
      left: Spacing.lg,
      right: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      // Inverted surface so it reads as dark in light mode (and light in dark mode).
      backgroundColor: colors.text,
      borderRadius: Radii.lg,
      paddingLeft: Spacing.lg,
      paddingRight: Spacing.xs,
    },
    message: {
      flex: 1,
      paddingVertical: Spacing.md,
      fontSize: Typography.fontSize.sm,
      color: colors.background,
    },
    action: { minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.md, justifyContent: 'center', alignItems: 'center' },
    actionText: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.primary,
    },
  });
}
