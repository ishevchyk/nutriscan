import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { GRAM_ONLY_UNITS, GRAM_UNIT, ALL_UNITS } from '../../constants/units';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePickProduct } from '../../hooks/usePickProduct';
import { useAddProductForMeal } from '../../hooks/useAddProductForMeal';
import { useMealForm, MealFormValues } from '../../hooks/useMealForm';
import { useUnitConversionGuard } from '../../hooks/useUnitConversionGuard';
import { useMealStore } from '../../store/mealStore';
import { afterSheetClose } from '../../utils/afterSheetClose';
import { NutritionSummaryCard } from '../../components/meals/NutritionSummaryCard';
import { IngredientCard } from '../../components/meals/IngredientCard';
import { IngredientManageSheet } from '../../components/meals/IngredientManageSheet';
import { AddIngredientSheet } from '../../components/meals/AddIngredientSheet';
import { MissingConversionSheet } from '../../components/meals/MissingConversionSheet';
import { PortionList } from '../../components/meals/PortionList';
import { toIngredientVM } from '../../components/meals/types';
import { CollapsibleSection, RichEditorField, RichTextView, SectionLabel, StatCard, Stepper, UnderlineField } from '../../components/ui';

const DEFAULT_INGREDIENT_AMOUNT = 100;

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    selected,
    selectedLoading,
    selectedError,
    fetchMeal,
    updateMeal,
    removeMeal,
    addIngredient,
    removeIngredient,
    relinkIngredient,
    unlinkIngredient,
    updateIngredientValues,
    addIngredientToLibrary,
    addPortion,
    updatePortion,
    removePortion,
  } = useMealStore();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pick } = usePickProduct();
  const { addProductForMeal } = useAddProductForMeal();
  const guard = useUnitConversionGuard();

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [managedKey, setManagedKey] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchMeal(id);
    }
  }, [id]);

  const meal = selected?.id === id ? selected : null;

  const { control, handleSubmit, watch, formState: { errors } } = useMealForm(meal ?? undefined);
  const watchedServings = watch('servings') ?? meal?.servings ?? 1;
  const watchedCookedWeightGrams = watch('cooked_weight_grams') ?? meal?.cooked_weight_grams ?? null;

  const ingredients = useMemo(() => (meal?.ingredients ?? []).map(toIngredientVM), [meal?.ingredients]);
  const managedIngredient = ingredients.find((i) => i.key === managedKey) ?? null;
  const totalGrams = ingredients.reduce((sum, i) => sum + i.grams, 0);
  const linkedCount = ingredients.filter((i) => i.is_linked).length;
  const manualCount = ingredients.length - linkedCount;

  async function onSubmit(data: MealFormValues) {
    if (!id) return;
    await updateMeal(id, data);
    setMode('view');
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(
      `Delete "${meal?.name}"?`,
      'This meal and its ingredients/portions will be moved to Recently Deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeMeal(id);
            router.back();
          },
        },
      ]
    );
  }

  // Cooked weight is a measured, not derived, quantity (how much water
  // evaporated/was absorbed isn't a fixed ratio of raw ingredient weight --
  // see README §3.5), so an ingredient edit never adjusts it automatically,
  // and this never suggests a number either -- unlike a one-off tracker log
  // entry, an edit here changes the saved meal itself, potentially for a long
  // time, so silently offering an auto-filled estimate risks it getting
  // accepted without a real re-weigh and then sitting wrong indefinitely.
  // Just a heads-up that it may now be stale; the user decides what to do.
  function noticeCookedWeightMayBeStale(oldTotalGrams: number) {
    const currentCookedWeight = watchedCookedWeightGrams;
    if (!currentCookedWeight || oldTotalGrams <= 0) return;
    const freshMeal = useMealStore.getState().selected;
    if (!freshMeal || freshMeal.id !== meal!.id) return;
    const newTotalGrams = freshMeal.ingredients.reduce((sum, i) => sum + i.grams, 0);
    if (Math.abs(newTotalGrams - oldTotalGrams) < 0.5) return;

    Alert.alert(
      'Recorded cooked weight may be stale',
      `Raw ingredients changed from ${Math.round(oldTotalGrams)}g to ${Math.round(newTotalGrams)}g. The recorded cooked weight (${Math.round(currentCookedWeight)}g) was measured for the old recipe -- consider re-weighing the dish and updating it if this changes the recipe meaningfully.`,
      [{ text: 'OK' }]
    );
  }

  async function commitQuantity(ingredient: (typeof ingredients)[number], amount: number, unit: string) {
    setBusyKey(ingredient.key);
    const oldTotalGrams = totalGrams;
    try {
      let committed = true;
      if (!ingredient.product_id || unit === GRAM_UNIT) {
        await updateIngredientValues(meal!.id, ingredient.key, { input_amount: amount, input_unit: unit });
      } else {
        const result = await guard.runGuarded(
          () => updateIngredientValues(meal!.id, ingredient.key, { input_amount: amount, input_unit: unit }),
          { productId: ingredient.product_id, productName: ingredient.name, unit }
        );
        committed = result.ok;
      }
      // Skip the offer if the user cancelled a missing-conversion prompt --
      // nothing was actually updated, so there's nothing to reconcile.
      if (committed) noticeCookedWeightMayBeStale(oldTotalGrams);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleChooseFromLibrary() {
    if (!id) return;
    setAddSheetOpen(false);
    afterSheetClose(async () => {
      const product = await pick();
      if (product) {
        await addIngredient(id, { product_id: product.id, input_amount: DEFAULT_INGREDIENT_AMOUNT, input_unit: GRAM_UNIT });
      }
    });
  }

  function handleAddProduct() {
    if (!id) return;
    setAddSheetOpen(false);
    afterSheetClose(async () => {
      const result = await addProductForMeal();
      if (!result) return;
      if (result.kind === 'library') {
        await addIngredient(id, {
          product_id: result.product.id,
          input_amount: DEFAULT_INGREDIENT_AMOUNT,
          input_unit: GRAM_UNIT,
        });
      } else {
        const { name, brand, calories, protein, fat, carbs, fiber, sugar, salt } = result.values;
        await addIngredient(id, {
          name,
          brand: brand || null,
          input_amount: DEFAULT_INGREDIENT_AMOUNT,
          input_unit: GRAM_UNIT,
          calories,
          protein,
          fat,
          carbs,
          fiber,
          sugar,
          salt,
        });
      }
    });
  }

  if (selectedLoading && !meal) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  if (selectedError && !meal) {
    return <Text style={styles.notFound}>{selectedError}</Text>;
  }

  if (!meal) {
    return <Text style={styles.notFound}>Meal not found.</Text>;
  }

  const isEditing = mode === 'edit';

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Title row */}
        {isEditing ? (
          <View style={styles.titleRow}>
            <View style={styles.titleField}>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <UnderlineField
                    label="Meal name"
                    value={value ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.name?.message}
                  />
                )}
              />
            </View>
            <Pressable style={styles.modeButton} onPress={handleSubmit(onSubmit)}>
              <Text style={styles.modeButtonText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{meal.name}</Text>
            <Pressable style={styles.modeButton} onPress={() => setMode('edit')}>
              <Text style={styles.modeButtonText}>Edit</Text>
            </Pressable>
          </View>
        )}

        {!isEditing && (
          <Text style={styles.metaLine}>
            {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} · {meal.servings} serving
            {meal.servings === 1 ? '' : 's'}
            {meal.cooked_weight_grams ? ` · ${Math.round(meal.cooked_weight_grams)}g cooked` : ''}
          </Text>
        )}

        {/* Meal steps */}
        {isEditing ? (
          <CollapsibleSection label="Meal steps" sublabel="Preparation notes shown on the meal" style={styles.blockSpacing}>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <RichEditorField
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="What this meal is, prep steps, etc."
                />
              )}
            />
          </CollapsibleSection>
        ) : meal.description ? (
          <CollapsibleSection label="Meal steps" style={styles.blockSpacing}>
            <RichTextView html={meal.description} />
          </CollapsibleSection>
        ) : null}

        {/* Servings */}
        {isEditing && (
          <Controller
            control={control}
            name="servings"
            render={({ field: { onChange, value } }) => (
              <Stepper label="Servings" value={value ?? 1} onChange={onChange} style={styles.blockSpacing} />
            )}
          />
        )}

        {/* Cooked weight */}
        {isEditing && (
          <>
            <Controller
              control={control}
              name="cooked_weight_grams"
              render={({ field: { onChange, onBlur, value } }) => (
                <StatCard
                  label="Cooked weight (optional)"
                  unit="g"
                  value={value ?? null}
                  onChangeValue={onChange}
                  onBlur={onBlur}
                  size="sm"
                  style={styles.blockSpacing}
                />
              )}
            />
            {errors.cooked_weight_grams?.message && (
              <Text style={styles.fieldError}>{errors.cooked_weight_grams.message}</Text>
            )}
          </>
        )}

        {/* Nutrition */}
        <NutritionSummaryCard
          perMeal={meal.nutrition.per_meal}
          per100g={meal.nutrition.per_100g}
          servings={isEditing ? watchedServings : meal.servings}
          totalGrams={totalGrams}
          cookedWeightGrams={watchedCookedWeightGrams}
          manualCount={manualCount}
        />

        {/* Add to Day Tracker */}
        {!isEditing && (
          <View style={styles.trackerBlock}>
            <Pressable
              style={styles.trackerButton}
              onPress={() => router.push({ pathname: '/log-entry', params: { mealId: meal.id } })}
            >
              <Text style={styles.trackerButtonText}>Add to Day Tracker</Text>
            </Pressable>
          </View>
        )}

        {/* Ingredients */}
        <View style={styles.sectionHeader}>
          <SectionLabel>{`Ingredients · ${ingredients.length}`}</SectionLabel>
          <Text style={styles.sectionMeta}>
            {isEditing
              ? manualCount > 0
                ? `${manualCount} not saved`
                : ''
              : `${linkedCount} in library · ${manualCount} own data`}
          </Text>
        </View>

        {isEditing && (
          <Pressable style={styles.addIngredientButton} onPress={() => setAddSheetOpen(true)}>
            <Text style={styles.addIngredientText}>+ Add ingredient</Text>
          </Pressable>
        )}

        {ingredients.map((ingredient) => (
          <IngredientCard
            key={ingredient.key}
            ingredient={ingredient}
            editable={isEditing}
            busy={busyKey === ingredient.key}
            onAmountCommit={(amount) => commitQuantity(ingredient, amount, ingredient.input_unit)}
            onUnitChange={(unit) => commitQuantity(ingredient, ingredient.input_amount, unit)}
            onMenuPress={() => setManagedKey(ingredient.key)}
          />
        ))}

        {isEditing && (
          <>
            <PortionList
              portions={meal.portions}
              onAdd={(input) => addPortion(meal.id, input)}
              onUpdate={(portionId, patch) => updatePortion(meal.id, portionId, patch)}
              onRemove={(portionId) => removePortion(meal.id, portionId)}
            />

            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>Delete Meal</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <IngredientManageSheet
        ingredient={managedIngredient}
        onClose={() => setManagedKey(null)}
        onOpenInLibrary={(productId) => {
          setManagedKey(null);
          afterSheetClose(() => router.push({ pathname: '/product/[id]', params: { id: productId } }));
        }}
        onSwap={() => {
          setManagedKey(null);
          const ing = managedIngredient;
          if (!ing) return;
          afterSheetClose(async () => {
            const product = await pick();
            if (product) {
              // Force the unit back to grams on swap -- a household unit's
              // grams-per-unit is product-specific, so it can't carry over.
              await relinkIngredient(meal.id, ing.key, product.id, { input_amount: ing.grams, input_unit: GRAM_UNIT });
            }
          });
        }}
        editValuesAllowedUnits={managedIngredient?.is_linked ? ALL_UNITS : GRAM_ONLY_UNITS}
        onEditValues={async (values) => {
          if (!managedIngredient) return;
          const ingredientKey = managedIngredient.key;
          const productId = managedIngredient.product_id;
          const oldTotalGrams = totalGrams;
          const commit = () => updateIngredientValues(meal.id, ingredientKey, values);
          // Keep the sheet open (its Save button shows a spinner) for the
          // duration of the network round-trip -- there's nothing to see
          // happen until this settles, so closing early just looks frozen.
          let committed = true;
          if (productId && values.input_unit !== GRAM_UNIT) {
            const result = await guard.runGuarded(commit, { productId, productName: values.name, unit: values.input_unit }, {
              onBeforePrompt: () => setManagedKey(null),
            });
            committed = result.ok;
          } else {
            await commit();
          }
          setManagedKey(null);
          // Skip the offer if the user cancelled a missing-conversion prompt --
          // nothing was actually updated, so there's nothing to reconcile.
          if (committed) afterSheetClose(() => noticeCookedWeightMayBeStale(oldTotalGrams));
        }}
        onUnlink={async () => {
          if (!managedIngredient) return;
          await unlinkIngredient(meal.id, managedIngredient.key);
          setManagedKey(null);
        }}
        onAddToLibrary={async () => {
          if (!managedIngredient) return;
          await addIngredientToLibrary(meal.id, managedIngredient.key);
          setManagedKey(null);
        }}
        onRemove={async () => {
          if (!managedIngredient) return;
          setManagedKey(null);
          await removeIngredient(meal.id, managedIngredient.key);
        }}
      />

      <AddIngredientSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onChooseFromLibrary={handleChooseFromLibrary}
        onAddProduct={handleAddProduct}
      />

      <MissingConversionSheet
        productName={guard.pending?.productName ?? null}
        unit={guard.pending?.unit ?? null}
        onCancel={guard.onCancel}
        onSave={guard.onResolve}
      />
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: Spacing.xl,
      backgroundColor: colors.pageBackground,
      gap: Spacing.md,
    },
    spinner: { marginTop: 40 },
    notFound: {
      color: colors.textSecondary,
      fontSize: Typography.fontSize.base,
      textAlign: 'center',
      marginTop: 40,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    titleField: { flex: 1 },
    fieldError: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginTop: -Spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      color: colors.text,
    },
    modeButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.md,
    },
    modeButtonText: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.onPrimary,
    },
    metaLine: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    blockSpacing: {},
    trackerBlock: { gap: Spacing.sm },
    trackerButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
    },
    trackerButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
    },
    sectionMeta: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      marginBottom: Spacing.xs,
    },
    addIngredientButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    addIngredientText: {
      color: colors.primary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
    deleteButton: {
      backgroundColor: colors.error,
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.xl,
    },
    deleteButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
