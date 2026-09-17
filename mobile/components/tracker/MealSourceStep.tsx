import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useMealStore } from '../../store/mealStore';
import { MealSlot, NewMealLogEntry, useLogStore } from '../../store/logStore';
import { computeIngredientsNutrition, scaleNutrition } from '../../utils/nutritionUtils';
import { sanitizeDecimalInput } from '../../utils/formatUtils';
import { toIngredientVM } from '../meals/types';
import { GroupChip } from '../groups/GroupChip';
import { CollapsibleSection, SegmentedTabs, Stepper } from '../ui';

type MealSourceStepProps = {
  mealId: string;
  mealSlot: MealSlot;
  onLogged: () => void;
};

type TrackerTab = 'meal' | 'portion' | 'grams';

/** 'servings' = the automatic 1/N-of-meal split; otherwise a MealPortion id. */
type PortionChoice = 'servings' | string;

const TABS: { key: TrackerTab; label: string }[] = [
  { key: 'meal', label: 'Whole Meal' },
  { key: 'portion', label: 'Portion' },
  { key: 'grams', label: 'By Grams' },
];

function formatAmount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function MealSourceStep({ mealId, mealSlot, onLogged }: MealSourceStepProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { selected, selectedLoading, fetchMeal } = useMealStore();
  const { addEntry } = useLogStore();

  useEffect(() => {
    if (selected?.id !== mealId) {
      void fetchMeal(mealId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  const meal = selected?.id === mealId ? selected : null;
  const ingredients = useMemo(() => (meal?.ingredients ?? []).map(toIngredientVM), [meal?.ingredients]);
  const servings = meal?.servings ?? 1;
  const portions = meal?.portions ?? [];

  const [tab, setTab] = useState<TrackerTab>('meal');
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [portionChoice, setPortionChoice] = useState<PortionChoice>('servings');
  const [portionCount, setPortionCount] = useState(1);
  const [gramsInput, setGramsInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A one-off, opt-in estimate for THIS log entry's logged amount, offered
  // when an ingredient override changes the raw total while the meal has a
  // cooked_weight_grams -- otherwise the amount stays pinned to the meal's
  // fixed cooked weight regardless of ingredient tweaks (intentional: cooked
  // weight is measured, not derived -- see the meal-edit screen's identical
  // reasoning). Never touches the saved meal, only this entry's preview/payload.
  const [quantityGramsOverride, setQuantityGramsOverride] = useState<number | null>(null);
  // The raw total the user last accepted/declined an offer for, so re-blurring
  // an unchanged field (or a field that nets back to the same total) doesn't
  // re-prompt for the same adjustment.
  const [respondedRawTotal, setRespondedRawTotal] = useState<number | null>(null);

  const originalRawTotal = useMemo(() => ingredients.reduce((sum, i) => sum + i.grams, 0), [ingredients]);

  useEffect(() => {
    setQuantityGramsOverride(null);
    setRespondedRawTotal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, portionChoice, portionCount, gramsInput]);

  const base = useMemo(
    () =>
      computeIngredientsNutrition(
        ingredients.map((i) => ({ ...i, grams: overrides[i.key] ?? i.grams }))
      ),
    [ingredients, overrides]
  );

  // A meal's raw ingredients often weigh something different once cooked
  // (water evaporation, etc.) -- when the meal has a recorded cooked weight,
  // logged grams are grams of the cooked dish, so that's the total this
  // screen's ratio math should be measured against, not the raw sum.
  const referenceGrams = meal?.cooked_weight_grams ?? base.totalGrams;

  const servingGrams = servings > 0 ? referenceGrams / servings : referenceGrams;
  const selectedNamedPortion =
    portionChoice === 'servings' ? null : portions.find((p) => p.id === portionChoice) ?? null;
  const portionGrams = selectedNamedPortion ? selectedNamedPortion.grams : servingGrams;
  const customGrams = gramsInput != null && gramsInput !== '' ? Number(gramsInput) : 100;

  const computedLoggedGrams =
    tab === 'meal' ? referenceGrams : tab === 'portion' ? portionCount * portionGrams : customGrams;
  const loggedGrams = quantityGramsOverride ?? computedLoggedGrams;
  const loggedNutrition =
    referenceGrams > 0 ? scaleNutrition(base.per_meal, loggedGrams / referenceGrams) : base.per_meal;

  function handleOverrideChange(key: string, raw: string) {
    const cleaned = sanitizeDecimalInput(raw);
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

  function handleIngredientBlur() {
    if (!meal?.cooked_weight_grams) return;
    const currentRawTotal = base.totalGrams;
    const baseline = respondedRawTotal ?? originalRawTotal;
    if (baseline <= 0 || Math.abs(currentRawTotal - baseline) < 0.5) return;
    setRespondedRawTotal(currentRawTotal);

    const currentLoggedGrams = loggedGrams;
    const suggested = Math.round((currentLoggedGrams * currentRawTotal) / baseline);
    if (Math.abs(suggested - currentLoggedGrams) < 0.5) return;

    Alert.alert(
      'Update logged amount?',
      `Ingredients now total ${Math.round(currentRawTotal)}g raw (was ${Math.round(baseline)}g). Scale this entry's logged amount from ${Math.round(currentLoggedGrams)}g to ~${suggested}g to match? This only affects this log entry, not the saved meal.`,
      [
        { text: 'Keep as-is', style: 'cancel' },
        { text: 'Update', onPress: () => setQuantityGramsOverride(suggested) },
      ]
    );
  }

  // POST /log only accepts `portion_id` (a real saved MealPortion) or
  // `ingredient_overrides` (a full snapshot replacement) -- there's no
  // first-class "N servings" or "custom total grams" API concept. The
  // "servings" pseudo-portion and "By Grams" tab both synthesize overrides
  // scaled by the ratio of logged grams to the meal's full total, matching
  // the ratio already used for this screen's live preview above.
  //
  // Only ingredients with a product_id can be represented in
  // ingredient_overrides -- unlinked ingredients are dropped from what's
  // logged whenever overrides are sent (see plan Open Decision #1).
  async function handleConfirm() {
    if (!meal || base.totalGrams <= 0) return;
    setSaving(true);
    try {
      const payload: NewMealLogEntry = {
        source_type: 'meal',
        meal_id: meal.id,
        meal_slot: mealSlot,
        logged_at: new Date().toISOString(),
        quantity_grams: loggedGrams,
      };

      if (tab === 'meal') {
        const hasOverrides = Object.keys(overrides).length > 0;
        if (hasOverrides) {
          payload.ingredient_overrides = ingredients
            .filter((i) => i.product_id)
            .map((i) => ({ product_id: i.product_id as string, grams: overrides[i.key] ?? i.grams }));
        }
        // else: neither portion_id nor ingredient_overrides -- backend logs
        // the full unscaled meal, which is exactly this tab's meaning.
      } else if (tab === 'portion' && selectedNamedPortion && Object.keys(overrides).length === 0) {
        payload.portion_id = selectedNamedPortion.id;
      } else {
        // A named portion combined with per-ingredient overrides can't be
        // represented by portion_id alone (it would discard the overrides),
        // so fall back to synthesizing overrides scaled by the same ratio
        // used for this screen's live preview -- same as the "By Grams" tab
        // and the "servings" pseudo-portion.
        const ratio = referenceGrams > 0 ? loggedGrams / referenceGrams : 1;
        payload.ingredient_overrides = ingredients
          .filter((i) => i.product_id)
          .map((i) => ({ product_id: i.product_id as string, grams: (overrides[i.key] ?? i.grams) * ratio }));
      }

      await addEntry(payload);
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  if (!meal) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  return (
    <View style={styles.body}>
      <Text style={styles.heading}>{meal.name}</Text>

      <CollapsibleSection label="Adjust ingredients" sublabel="Used a different amount this time? Tweak grams here">
        {ingredients.map((ingredient) => {
          const overridden = overrides[ingredient.key] != null;
          return (
            <View key={ingredient.key} style={styles.adjustRow}>
              <View style={styles.adjustIdentity}>
                <Text style={styles.adjustName} numberOfLines={1}>
                  {ingredient.name}
                </Text>
                <Text style={styles.adjustSublabel}>{overridden ? 'Adjusted' : 'As in meal'}</Text>
              </View>
              <View style={styles.gramsPill}>
                <TextInput
                  style={styles.gramsInput}
                  defaultValue={String(ingredient.grams)}
                  onChangeText={(raw) => handleOverrideChange(ingredient.key, raw)}
                  onBlur={handleIngredientBlur}
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
          Adjustments apply to this tracker entry - the saved meal stays unchanged, and carry over across Whole
          Meal, Portion, and By Grams
        </Text>
      </CollapsibleSection>

      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'portion' ? (
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
      ) : tab === 'grams' ? (
        <View style={styles.gramsCard}>
          <Text style={styles.gramsCardLabel}>Grams of meal</Text>
          <View style={[styles.gramsPill, styles.gramsPillLarge]}>
            <TextInput
              style={styles.gramsInput}
              value={gramsInput ?? String(Math.round(loggedGrams))}
              onChangeText={(raw) => setGramsInput(sanitizeDecimalInput(raw))}
              keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={styles.gramsUnit}>g</Text>
          </View>
        </View>
      ) : null}

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

      <Pressable
        style={[styles.confirmButton, saving && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        disabled={saving}
      >
        <Text style={styles.confirmButtonText}>{saving ? 'Logging…' : 'Log entry'}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    spinner: { marginTop: 40 },
    body: { gap: Spacing.lg, paddingTop: Spacing.sm },
    heading: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
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
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    confirmButtonDisabled: { opacity: 0.5 },
    confirmButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
