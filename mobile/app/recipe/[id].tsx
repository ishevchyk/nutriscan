import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { GRAM_ONLY_UNITS, GRAM_UNIT, ALL_UNITS } from '../../constants/units';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePickProduct } from '../../hooks/usePickProduct';
import { useAddProductForRecipe } from '../../hooks/useAddProductForRecipe';
import { useRecipeForm, RecipeFormValues } from '../../hooks/useRecipeForm';
import { useUnitConversionGuard } from '../../hooks/useUnitConversionGuard';
import { useRecipeStore } from '../../store/recipeStore';
import { afterSheetClose } from '../../utils/afterSheetClose';
import { NutritionSummaryCard } from '../../components/recipes/NutritionSummaryCard';
import { IngredientCard } from '../../components/recipes/IngredientCard';
import { IngredientManageSheet } from '../../components/recipes/IngredientManageSheet';
import { AddIngredientSheet } from '../../components/recipes/AddIngredientSheet';
import { AddToTrackerSheet } from '../../components/recipes/AddToTrackerSheet';
import { MissingConversionSheet } from '../../components/recipes/MissingConversionSheet';
import { PortionList } from '../../components/recipes/PortionList';
import { toIngredientVM } from '../../components/recipes/types';
import { CollapsibleSection, RichEditorField, RichTextView, SectionLabel, Stepper, UnderlineField } from '../../components/ui';

const DEFAULT_INGREDIENT_AMOUNT = 100;

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    selected,
    selectedLoading,
    selectedError,
    fetchRecipe,
    updateRecipe,
    removeRecipe,
    addIngredient,
    removeIngredient,
    relinkIngredient,
    unlinkIngredient,
    updateIngredientValues,
    addIngredientToLibrary,
    addPortion,
    updatePortion,
    removePortion,
  } = useRecipeStore();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pick } = usePickProduct();
  const { addProductForRecipe } = useAddProductForRecipe();
  const guard = useUnitConversionGuard();

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [managedKey, setManagedKey] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [trackerSheetOpen, setTrackerSheetOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchRecipe(id);
    }
  }, [id]);

  const recipe = selected?.id === id ? selected : null;

  const { control, handleSubmit, watch, formState: { errors } } = useRecipeForm(recipe ?? undefined);
  const watchedServings = watch('servings') ?? recipe?.servings ?? 1;

  const ingredients = useMemo(() => (recipe?.ingredients ?? []).map(toIngredientVM), [recipe?.ingredients]);
  const managedIngredient = ingredients.find((i) => i.key === managedKey) ?? null;
  const totalGrams = ingredients.reduce((sum, i) => sum + i.grams, 0);
  const linkedCount = ingredients.filter((i) => i.is_linked).length;
  const manualCount = ingredients.length - linkedCount;

  async function onSubmit(data: RecipeFormValues) {
    if (!id) return;
    await updateRecipe(id, data);
    setMode('view');
  }

  function onDelete() {
    if (!id) return;
    Alert.alert(
      `Delete "${recipe?.name}"?`,
      'This recipe and its ingredients/portions will be moved to Recently Deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeRecipe(id);
            router.back();
          },
        },
      ]
    );
  }

  async function commitQuantity(ingredient: (typeof ingredients)[number], amount: number, unit: string) {
    setBusyKey(ingredient.key);
    try {
      if (!ingredient.product_id || unit === GRAM_UNIT) {
        await updateIngredientValues(recipe!.id, ingredient.key, { input_amount: amount, input_unit: unit });
        return;
      }
      await guard.runGuarded(
        () => updateIngredientValues(recipe!.id, ingredient.key, { input_amount: amount, input_unit: unit }),
        { productId: ingredient.product_id, productName: ingredient.name, unit }
      );
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
      const result = await addProductForRecipe();
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

  if (selectedLoading && !recipe) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  if (selectedError && !recipe) {
    return <Text style={styles.notFound}>{selectedError}</Text>;
  }

  if (!recipe) {
    return <Text style={styles.notFound}>Recipe not found.</Text>;
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
                    label="Recipe name"
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
            <Text style={styles.title}>{recipe.name}</Text>
            <Pressable style={styles.modeButton} onPress={() => setMode('edit')}>
              <Text style={styles.modeButtonText}>Edit</Text>
            </Pressable>
          </View>
        )}

        {!isEditing && (
          <Text style={styles.metaLine}>
            {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} · {recipe.servings} serving
            {recipe.servings === 1 ? '' : 's'}
          </Text>
        )}

        {/* Recipe steps */}
        {isEditing ? (
          <CollapsibleSection label="Recipe steps" sublabel="Preparation notes shown on the recipe" style={styles.blockSpacing}>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <RichEditorField
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="What this recipe is, prep steps, etc."
                />
              )}
            />
          </CollapsibleSection>
        ) : recipe.description ? (
          <CollapsibleSection label="Recipe steps" style={styles.blockSpacing}>
            <RichTextView html={recipe.description} />
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

        {/* Nutrition */}
        <NutritionSummaryCard
          perMeal={recipe.nutrition.per_meal}
          per100g={recipe.nutrition.per_100g}
          servings={isEditing ? watchedServings : recipe.servings}
          totalGrams={totalGrams}
          manualCount={manualCount}
        />

        {/* Add to Day Tracker */}
        {!isEditing && (
          <View style={styles.trackerBlock}>
            <Pressable style={styles.trackerButton} onPress={() => setTrackerSheetOpen(true)}>
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
              portions={recipe.portions}
              onAdd={(input) => addPortion(recipe.id, input)}
              onUpdate={(portionId, patch) => updatePortion(recipe.id, portionId, patch)}
              onRemove={(portionId) => removePortion(recipe.id, portionId)}
            />

            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>Delete Recipe</Text>
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
              await relinkIngredient(recipe.id, ing.key, product.id, { input_amount: ing.grams, input_unit: GRAM_UNIT });
            }
          });
        }}
        editValuesAllowedUnits={managedIngredient?.is_linked ? ALL_UNITS : GRAM_ONLY_UNITS}
        onEditValues={async (values) => {
          if (!managedIngredient) return;
          const ingredientKey = managedIngredient.key;
          const productId = managedIngredient.product_id;
          const commit = () => updateIngredientValues(recipe.id, ingredientKey, values);
          // Keep the sheet open (its Save button shows a spinner) for the
          // duration of the network round-trip -- there's nothing to see
          // happen until this settles, so closing early just looks frozen.
          if (productId && values.input_unit !== GRAM_UNIT) {
            await guard.runGuarded(commit, { productId, productName: values.name, unit: values.input_unit }, {
              onBeforePrompt: () => setManagedKey(null),
            });
          } else {
            await commit();
          }
          setManagedKey(null);
        }}
        onUnlink={async () => {
          if (!managedIngredient) return;
          await unlinkIngredient(recipe.id, managedIngredient.key);
          setManagedKey(null);
        }}
        onAddToLibrary={async () => {
          if (!managedIngredient) return;
          await addIngredientToLibrary(recipe.id, managedIngredient.key);
          setManagedKey(null);
        }}
        onRemove={async () => {
          if (!managedIngredient) return;
          setManagedKey(null);
          await removeIngredient(recipe.id, managedIngredient.key);
        }}
      />

      <AddIngredientSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onChooseFromLibrary={handleChooseFromLibrary}
        onAddProduct={handleAddProduct}
      />

      <AddToTrackerSheet
        visible={trackerSheetOpen}
        onClose={() => setTrackerSheetOpen(false)}
        recipeName={recipe.name}
        servings={recipe.servings}
        ingredients={ingredients}
        portions={recipe.portions}
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
