import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { GRAM_ONLY_UNITS, ALL_UNITS } from '../../constants/units';
import { LinkBadge } from './LinkBadge';
import { QuantityInput } from './QuantityInput';
import { IngredientVM } from './types';

type IngredientCardProps = {
  ingredient: IngredientVM;
  editable?: boolean;
  /** True while a quantity/unit commit for this ingredient is in flight (e.g.
   * resolving a missing unit conversion) -- swaps the quantity control for a
   * spinner instead of leaving the row silently unresponsive. */
  busy?: boolean;
  onAmountCommit?: (amount: number) => void;
  onUnitChange?: (unit: string) => void;
  onMenuPress: () => void;
};

function formatContribution(perHundred: number | null, grams: number): string {
  if (perHundred == null) return '—';
  const value = Math.round(((perHundred * grams) / 100) * 10) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function IngredientCard({ ingredient, editable = false, busy = false, onAmountCommit, onUnitChange, onMenuPress }: IngredientCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const allowedUnits = ingredient.is_linked ? ALL_UNITS : GRAM_ONLY_UNITS;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {ingredient.name}
            </Text>
            <LinkBadge linked={ingredient.is_linked} />
          </View>
          {ingredient.brand ? <Text style={styles.brand}>{ingredient.brand}</Text> : null}
        </View>

        <View style={styles.controls}>
          {busy ? (
            <ActivityIndicator color={colors.primary} style={styles.busyIndicator} />
          ) : (
            <QuantityInput
              amount={ingredient.input_amount}
              unit={ingredient.input_unit}
              editable={editable}
              allowedUnits={allowedUnits}
              approxGrams={ingredient.grams}
              onAmountCommit={onAmountCommit}
              onUnitChange={onUnitChange}
            />
          )}
          <Pressable onPress={onMenuPress} hitSlop={10} disabled={busy}>
            <MaterialDesignIcons name="dots-vertical" size={20} color={busy ? colors.border : colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.macroRow}>
        {(
          [
            [ingredient.calories, 'kcal'],
            [ingredient.protein, 'p'],
            [ingredient.fat, 'f'],
            [ingredient.carbs, 'c'],
          ] as const
        ).map(([value, label]) => (
          <View key={label} style={styles.macroCell}>
            <Text style={styles.macroValue}>{formatContribution(value, ingredient.grams)}</Text>
            <Text style={styles.macroLabel}>{label}</Text>
          </View>
        ))}
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
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    identity: { flex: 1, gap: 2 },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    name: {
      flexShrink: 1,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    brand: {
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    busyIndicator: {
      minWidth: 64,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    macroRow: {
      flexDirection: 'row',
    },
    macroCell: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    macroValue: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
    },
    macroLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
  });
}
