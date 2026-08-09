import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type GroupChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function GroupChip({ label, selected = false, onPress }: GroupChipProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryPressed,
    },
    chipText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
    chipTextSelected: {
      color: colors.onPrimary,
      fontFamily: Typography.fontFamily.monoBold,
    },
  });
}
