import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { StatCard, StatGrid } from '../ui';
import { MealSlot, NewManualLogEntry, useLogStore } from '../../store/logStore';

type ManualSourceStepProps = {
  mealSlot: MealSlot;
  onLogged: () => void;
};

export function ManualSourceStep({ mealSlot, onLogged }: ManualSourceStepProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addEntry } = useLogStore();

  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const complete = calories != null && protein != null && fat != null && carbs != null;

  async function handleConfirm() {
    if (!complete) return;
    setSaving(true);
    try {
      const payload: NewManualLogEntry = {
        source_type: 'manual',
        manual_calories: calories,
        manual_protein: protein,
        manual_fat: fat,
        manual_carbs: carbs,
        meal_slot: mealSlot,
        logged_at: new Date().toISOString(),
      };
      await addEntry(payload);
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Enter it manually</Text>
      <StatGrid columns={2}>
        <StatCard label="Calories" unit="kcal" value={calories} onChangeValue={setCalories} />
        <StatCard label="Protein" unit="g" value={protein} onChangeValue={setProtein} />
        <StatCard label="Fat" unit="g" value={fat} onChangeValue={setFat} />
        <StatCard label="Carbs" unit="g" value={carbs} onChangeValue={setCarbs} />
      </StatGrid>
      <Pressable
        style={[styles.confirmButton, (!complete || saving) && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        disabled={!complete || saving}
      >
        <Text style={styles.confirmButtonText}>{saving ? 'Logging…' : 'Log entry'}</Text>
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
    confirmButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    confirmButtonDisabled: { opacity: 0.5 },
    confirmButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
