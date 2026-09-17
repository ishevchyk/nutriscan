import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LogTotals } from '../../store/logStore';
import { ProgressBar } from './ProgressBar';

type CaloriesSummaryCardProps = {
  totals: LogTotals;
  goals: LogTotals | null;
};

const MACRO_ROWS: { key: keyof Omit<LogTotals, 'calories'>; label: string }[] = [
  { key: 'protein', label: 'PROTEIN' },
  { key: 'fat', label: 'FAT' },
  { key: 'carbs', label: 'CARBS' },
];

export function CaloriesSummaryCard({ totals, goals }: CaloriesSummaryCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  if (!goals) {
    return (
      <Pressable style={styles.emptyCard} onPress={() => router.push('/goals')}>
        <Text style={styles.emptyText}>Set a daily goal →</Text>
      </Pressable>
    );
  }

  const left = Math.round(goals.calories - totals.calories);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>CALORIES</Text>
        {/*TODO:Add button to switch between views and open full view*/}
        <Text style={styles.leftLabel}>{left} KCAL LEFT</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.currentValue}>{Math.round(totals.calories)}</Text>
        <Text style={styles.goalValue}> / {Math.round(goals.calories)}</Text>
      </View>
      <ProgressBar value={totals.calories} max={goals.calories} height={10} style={styles.mainBar} />

      <View style={styles.macroRow}>
        {MACRO_ROWS.map(({ key, label }) => {
          const current = totals[key];
          const goal = goals[key];
          const over = goal > 0 && current > goal;
          return (
            <View key={key} style={styles.macroCell}>
              <Text style={styles.macroLabel}>{label}</Text>
              <Text style={styles.macroValue}>
                {Math.round(current)}/{Math.round(goal)}g
              </Text>
              <ProgressBar
                value={current}
                max={goal}
                color={over ? colors.error : colors.primary}
                height={5}
                style={styles.macroBar}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    leftLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    valueRow: { flexDirection: 'row', alignItems: 'baseline' },
    currentValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.xl,
      color: colors.text,
    },
    goalValue: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.lg,
      color: colors.textSecondary,
    },
    mainBar: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
    macroRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    macroCell: { flex: 1, gap: 4 },
    macroLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    macroValue: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      color: colors.text,
    },
    macroBar: {},
    emptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.primary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
