import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { RecipePortion } from '../../store/recipeStore';
import { computeIngredientsNutrition, scaleNutrition } from '../../utils/nutritionUtils';
import { GroupChip } from '../groups/GroupChip';
import { BottomSheet, CollapsibleSection, SegmentedTabs, Stepper } from '../ui';
import { IngredientVM } from './types';

type TrackerTab = 'meal' | 'portion' | 'grams';

/** 'servings' = the automatic 1/N-of-meal split; otherwise a RecipePortion id. */
type PortionChoice = 'servings' | string;

type AddToTrackerSheetProps = {
  visible: boolean;
  onClose: () => void;
  recipeName: string;
  servings: number;
  ingredients: IngredientVM[];
  portions?: RecipePortion[];
};

const TABS: { key: TrackerTab; label: string }[] = [
  { key: 'meal', label: 'Whole Meal' },
  { key: 'portion', label: 'Portion' },
  { key: 'grams', label: 'By Grams' },
];

const TAB_LABELS: Record<TrackerTab, string> = {
  meal: 'Whole meal',
  portion: 'Portion',
  grams: 'By grams',
};

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function AddToTrackerSheet({
  visible,
  onClose,
  recipeName,
  servings,
  ingredients,
  portions = [],
}: AddToTrackerSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<TrackerTab>('meal');
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [portionChoice, setPortionChoice] = useState<PortionChoice>('servings');
  const [portionCount, setPortionCount] = useState(1);
  const [gramsInput, setGramsInput] = useState<string | null>(null);

  const base = useMemo(
    () =>
      computeIngredientsNutrition(
        ingredients.map((i) => ({ ...i, grams: overrides[i.key] ?? i.grams }))
      ),
    [ingredients, overrides]
  );

  const servingGrams = servings > 0 ? base.totalGrams / servings : base.totalGrams;
  const selectedNamedPortion =
    portionChoice === 'servings' ? null : portions.find((p) => p.id === portionChoice) ?? null;
  const portionGrams = selectedNamedPortion ? selectedNamedPortion.grams : servingGrams;
  const customGrams = gramsInput != null && gramsInput !== '' ? Number(gramsInput) : base.totalGrams;

  const loggedGrams =
    tab === 'meal' ? base.totalGrams : tab === 'portion' ? portionCount * portionGrams : customGrams;
  const loggedNutrition =
    base.totalGrams > 0 ? scaleNutrition(base.per_meal, loggedGrams / base.totalGrams) : base.per_meal;

  function handleConfirm() {
    Alert.alert('Day Tracker', 'Day Tracker is coming soon.', [{ text: 'OK', onPress: onClose }]);
  }

  function handleOverrideChange(key: string, raw: string) {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    setOverrides((current) => {
      const next = { ...current };
      if (cleaned === '' || Number.isNaN(parsed) || parsed <= 0) {
        delete next[key];
      } else {
        next[key] = parsed;
      }
      return next;
    });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add to Day Tracker" subtitle={recipeName} scrollable>
      <View style={styles.body}>
        <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'meal' ? (
          <>
            <CollapsibleSection label="Adjust ingredients" sublabel="Used a different amount this time? Tweak grams here">
              {ingredients.map((ingredient) => {
                const overridden = overrides[ingredient.key] != null;
                return (
                  <View key={ingredient.key} style={styles.adjustRow}>
                    <View style={styles.adjustIdentity}>
                      <Text style={styles.adjustName} numberOfLines={1}>
                        {ingredient.name}
                      </Text>
                      <Text style={styles.adjustSublabel}>{overridden ? 'Adjusted' : 'As in recipe'}</Text>
                    </View>
                    <View style={styles.gramsPill}>
                      <TextInput
                        style={styles.gramsInput}
                        defaultValue={String(ingredient.grams)}
                        onChangeText={(raw) => handleOverrideChange(ingredient.key, raw)}
                        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                      />
                      <Text style={styles.gramsUnit}>g</Text>
                    </View>
                  </View>
                );
              })}
              <Text style={styles.adjustFootnote}>
                Adjustments apply to this tracker entry - the saved recipe stays unchanged
              </Text>
            </CollapsibleSection>
          </>
        ) : tab === 'portion' ? (
          <View style={styles.portionBlock}>
            {portions.length > 0 && (
              <View style={styles.portionChips}>
                <GroupChip
                  label={`1/${servings} of meal · ${Math.round(servingGrams)}g`}
                  selected={portionChoice === 'servings'}
                  onPress={() => setPortionChoice('servings')}
                />
                {portions.map((portion) => (
                  <GroupChip
                    key={portion.id}
                    label={`${portion.name} · ${Math.round(portion.grams)}g`}
                    selected={portionChoice === portion.id}
                    onPress={() => setPortionChoice(portion.id)}
                  />
                ))}
              </View>
            )}
            <Stepper
              label={
                selectedNamedPortion
                  ? `${selectedNamedPortion.name} · ${Math.round(portionGrams)}g each`
                  : `Portions · ${Math.round(portionGrams)}g each`
              }
              value={portionCount}
              onChange={setPortionCount}
              min={1}
            />
          </View>
        ) : (
          <View style={styles.gramsCard}>
            <Text style={styles.gramsCardLabel}>Grams of meal</Text>
            <View style={[styles.gramsPill, styles.gramsPillLarge]}>
              <TextInput
                style={styles.gramsInput}
                value={gramsInput ?? String(Math.round(base.totalGrams))}
                onChangeText={(raw) => setGramsInput(raw.replace(/[^0-9.]/g, ''))}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={styles.gramsUnit}>g</Text>
            </View>
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatAmount(loggedNutrition.calories)}</Text>
              <Text style={styles.statLabel}>kcal</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatAmount(loggedNutrition.protein)}g</Text>
              <Text style={styles.statLabel}>protein</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatAmount(loggedNutrition.fat)}g</Text>
              <Text style={styles.statLabel}>fat</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatAmount(loggedNutrition.carbs)}g</Text>
              <Text style={styles.statLabel}>carbs</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Add to Day Tracker</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { gap: Spacing.lg, paddingTop: Spacing.sm },
    caption: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
    },
    adjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    adjustIdentity: { flex: 1, gap: 2 },
    adjustName: {
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.medium,
      color: colors.text,
    },
    adjustSublabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    portionBlock: { gap: Spacing.md },
    portionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    adjustFootnote: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      marginTop: Spacing.xs,
    },
    gramsPill: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      minWidth: 64,
      justifyContent: 'flex-end',
    },
    gramsPillLarge: {
      minWidth: 88,
      backgroundColor: colors.background,
    },
    gramsInput: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
      padding: 0,
      minWidth: 32,
      textAlign: 'right',
    },
    gramsUnit: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
    },
    gramsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    gramsCardLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    statsRow: { flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', gap: Spacing.xs },
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
    summaryFootnote: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    confirmButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
