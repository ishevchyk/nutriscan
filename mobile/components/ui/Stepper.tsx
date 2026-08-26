import { useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  style?: StyleProp<ViewStyle>;
};

export function Stepper({ label, value, onChange, min = 1, style }: StepperProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const canDecrement = value > min;

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          style={[styles.stepButton, !canDecrement && styles.stepButtonDisabled]}
          onPress={() => canDecrement && onChange(value - 1)}
          hitSlop={6}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable style={styles.stepButton} onPress={() => onChange(value + 1)} hitSlop={6}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    label: {
      flexShrink: 1,
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.lg,
    },
    stepButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
    },
    stepButtonDisabled: { opacity: 0.4 },
    stepButtonText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    value: {
      minWidth: 24,
      textAlign: 'center',
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
  });
}
