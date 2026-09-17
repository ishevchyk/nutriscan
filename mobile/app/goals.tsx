import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useGoalStore } from '../store/goalStore';
import { StatCard, StatGrid } from '../components/ui';

export default function GoalsScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { goal, isSet, loaded, loading, updateGoal, loadGoal } = useGoalStore();

  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) {
      loadGoal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (goal) {
      setCalories(goal.calories_goal);
      setProtein(goal.protein_goal);
      setFat(goal.fat_goal);
      setCarbs(goal.carbs_goal);
    }
  }, [goal]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateGoal({
        calories_goal: calories,
        protein_goal: protein,
        fat_goal: fat,
        carbs_goal: carbs,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (loading && !loaded) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {!isSet && (
        <>
          <Text style={styles.heading}>Set your daily goals</Text>
          <Text style={styles.subheading}>
            These drive the calorie and macro progress bars on your Day tracker. You can change them any time.
          </Text>
        </>
      )}

      <StatGrid columns={2}>
        <StatCard label="Calories" unit="kcal" value={calories} onChangeValue={setCalories} />
        <StatCard label="Protein" unit="g" value={protein} onChangeValue={setProtein} />
        <StatCard label="Fat" unit="g" value={fat} onChangeValue={setFat} />
        <StatCard label="Carbs" unit="g" value={carbs} onChangeValue={setCarbs} />
      </StatGrid>

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Goals'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: Spacing.xl,
      backgroundColor: colors.pageBackground,
      gap: Spacing.lg,
    },
    spinner: { marginTop: 40 },
    heading: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      color: colors.text,
    },
    subheading: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      marginTop: -Spacing.sm,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.6 },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
