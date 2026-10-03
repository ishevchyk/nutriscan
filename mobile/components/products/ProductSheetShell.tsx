import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BottomSheet } from '../ui/BottomSheet';

type ProductSheetShellProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  onReset: () => void;
  resetDisabled?: boolean;
  /** Live count of products the current filters/sort would show. */
  resultCount: number;
  children: ReactNode;
};

/**
 * Shared chrome for the Products screen's Filters and Sort sheets: big
 * title, RESET / DONE actions, and a pinned "Show N products" button.
 * Changes inside apply live (the list behind the sheet is already updated),
 * so DONE and the bottom button both simply close.
 */
export function ProductSheetShell({
  visible,
  onClose,
  title,
  onReset,
  resetDisabled,
  resultCount,
  children,
}: ProductSheetShellProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      fullHeight
      scrollable
      title={<Text style={styles.title}>{title}</Text>}
      headerRight={
        <View style={styles.actions}>
          <Pressable onPress={onReset} disabled={resetDisabled} hitSlop={8}>
            <Text style={[styles.action, styles.reset, resetDisabled && styles.disabled]}>Reset</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.action, styles.done]}>Done</Text>
          </Pressable>
        </View>
      }
      footer={
        <Pressable
          style={({ pressed }) => [styles.showButton, pressed && styles.showButtonPressed]}
          onPress={onClose}
        >
          <Text style={styles.showButtonText}>
            {resultCount === 0 ? 'No matching products' : `Show ${resultCount} product${resultCount === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      }
    >
      {children}
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      color: colors.text,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xl, paddingTop: Spacing.sm },
    action: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
    },
    reset: { color: colors.textSecondary },
    done: { color: colors.primary, fontFamily: Typography.fontFamily.monoBold },
    disabled: { opacity: 0.4 },
    showButton: {
      backgroundColor: colors.primary,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    showButtonPressed: { backgroundColor: colors.primaryPressed },
    showButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
