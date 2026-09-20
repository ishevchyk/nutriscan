import {useMemo, useState} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { LogEntry, MealIngredientDefaults, MealSlot } from '../../store/logStore';
import { Product } from '../../store/productStore';
import { MealSummary } from '../../store/mealStore';
import { MEAL_SLOT_LABELS } from '../../utils/mealSlotUtils';
import { computeAdjustedIngredientCount } from '../../utils/logUtils';
import { LogEntryCard } from './LogEntryCard';

type MealSlotSectionProps = {
  slot: MealSlot;
  entries: LogEntry[];
  products: Product[];
  meals: MealSummary[];
  mealDefaultsCache: Record<string, MealIngredientDefaults>;
  onAddPress: () => void;
  onDeleteEntry: (id: string) => void;
  onUpdateAmount: (entry: LogEntry, grams: number) => void;
};

export function MealSlotSection({
  slot,
  entries,
  products,
  meals,
  mealDefaultsCache,
  onAddPress,
  onDeleteEntry,
  onUpdateAmount,
}: MealSlotSectionProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const subtotal = entries.reduce((sum, e) => sum + e.macros.calories, 0);
  const label = MEAL_SLOT_LABELS[slot];

  const [isCollapsed, setIsCollapsed] = useState(true);

  // Backend returns entries ordered oldest-first (logged_at ASC), so the
  // two most recently logged entries are the tail of the array.
  const visibleEntries = isCollapsed ? entries.slice(-2) : entries;

  return (
    <View style={styles.section}>
      <View style={styles.container}>
        <Pressable style={[styles.header, visibleEntries.length > 0 && styles.headerDivider]} onPress={() => setIsCollapsed(!isCollapsed)}>
          <View style={styles.headerLabelRow}>
            <Text style={styles.headerLabel}>{label.toUpperCase()}</Text>
            <Text style={styles.headerSubtotal}>{entries.length > 0 ? ` | ${Math.round(subtotal)} KCAL` : ''}</Text>
          </View>
          {entries.length > 2 && (
            <View style={styles.collapseToggle}>
              {isCollapsed && <Text style={styles.collapseToggleLabel}>+{entries.length - 2}</Text>}
              <MaterialDesignIcons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={16}
                color={colors.primary}
              />
            </View>
          )}
        </Pressable>

        {visibleEntries.map((entry, index) => (
          <LogEntryCard
            key={entry.id}
            entry={entry}
            product={entry.product_id ? products.find((p) => p.id === entry.product_id) : undefined}
            mealName={entry.meal_id ? meals.find((m) => m.id === entry.meal_id)?.name : undefined}
            adjustedCount={
              entry.meal_id ? computeAdjustedIngredientCount(entry, mealDefaultsCache[entry.meal_id]) : 0
            }
            isLast={index === visibleEntries.length - 1}
            onDelete={() => onDeleteEntry(entry.id)}
            onUpdateAmount={(grams) => onUpdateAmount(entry, grams)}
          />
        ))}
      </View>

      <Pressable style={styles.addButton} onPress={onAddPress}>
        <Text style={styles.addButtonText}>+ ADD TO {label.toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { gap: Spacing.sm },
    container: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
    },
    headerDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.medium,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.textSecondary,
    },
    headerSubtotal: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      color: colors.textTertiary,
    },
    collapseToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    collapseToggleLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      fontWeight: Typography.fontWeight.medium,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.primary,
    },
    addButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    addButtonText: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.primary,
    },
  });
}
