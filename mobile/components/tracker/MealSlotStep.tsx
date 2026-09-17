import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { MEAL_SLOTS, MealSlot } from '../../store/logStore';
import { MEAL_SLOT_LABELS, getDefaultMealSlotForTime } from '../../utils/mealSlotUtils';

type MealSlotStepProps = {
  onContinue: (slot: MealSlot) => void;
};

export function MealSlotStep({ onContinue }: MealSlotStepProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [slot, setSlot] = useState<MealSlot>(() => getDefaultMealSlotForTime());

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Which meal is this for?</Text>
      {MEAL_SLOTS.map((s) => {
        const selected = s === slot;
        return (
          <Pressable key={s} style={[styles.row, selected && styles.rowSelected]} onPress={() => setSlot(s)}>
            <Text style={[styles.rowText, selected && styles.rowTextSelected]}>{MEAL_SLOT_LABELS[s]}</Text>
          </Pressable>
        );
      })}
      <Pressable style={styles.continueButton} onPress={() => onContinue(slot)}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    heading: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    row: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      backgroundColor: colors.card,
    },
    rowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    rowText: {
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    rowTextSelected: {
      color: colors.primary,
      fontWeight: Typography.fontWeight.semibold,
    },
    continueButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    continueButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
