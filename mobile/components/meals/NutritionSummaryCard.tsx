import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { NutritionOut } from '../../store/mealStore';
import { perPortion } from '../../utils/nutritionUtils';
import { SegmentedTabs } from '../ui';

type NutritionTab = 'per_meal' | 'per_100g' | 'per_portion';

type NutritionSummaryCardProps = {
  perMeal: NutritionOut;
  per100g: NutritionOut;
  servings: number;
  totalGrams: number;
  manualCount: number;
};

const TABS: { key: NutritionTab; label: string }[] = [
  { key: 'per_meal', label: 'Per Meal' },
  { key: 'per_100g', label: 'Per 100g' },
  { key: 'per_portion', label: 'Per Portion' },
];

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function NutritionSummaryCard({ perMeal, per100g, servings, totalGrams, manualCount }: NutritionSummaryCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [active, setActive] = useState<NutritionTab>('per_meal');

  const nutrition =
    active === 'per_meal' ? perMeal : active === 'per_100g' ? per100g : perPortion(perMeal, servings);

  const footnote = `${Math.round(totalGrams)}g total${
    manualCount > 0
      ? ` · includes ${manualCount} manually-entered ingredient${manualCount === 1 ? '' : 's'}`
      : ''
  }`;

  return (
    <View style={styles.card}>
      <SegmentedTabs tabs={TABS} active={active} onChange={setActive} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(nutrition.calories)}</Text>
          <Text style={styles.statLabel}>kcal</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(nutrition.protein)}g</Text>
          <Text style={styles.statLabel}>protein</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(nutrition.fat)}g</Text>
          <Text style={styles.statLabel}>fat</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatAmount(nutrition.carbs)}g</Text>
          <Text style={styles.statLabel}>carbs</Text>
        </View>
      </View>

      <Text style={styles.footnote}>{footnote}</Text>
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
      gap: Spacing.lg,
    },
    statsRow: {
      flexDirection: 'row',
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    statValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
    statLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    footnote: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
  });
}
