import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { GRAM_ONLY_UNITS, GRAM_UNIT, ALL_UNITS } from '../constants/units';
import { useThemeColor } from '../hooks/useThemeColor';
import { usePickProduct } from '../hooks/usePickProduct';
import { useAddProductForRecipe } from '../hooks/useAddProductForRecipe';
import { useRecipeForm, RecipeFormValues } from '../hooks/useRecipeForm';
import { useUnitConversionGuard } from '../hooks/useUnitConversionGuard';
import { IngredientInput, useRecipeStore } from '../store/recipeStore';
import { Product, useProductStore } from '../store/productStore';
import { afterSheetClose } from '../utils/afterSheetClose';
import { NutritionSummaryCard } from '../components/recipes/NutritionSummaryCard';
import { IngredientCard } from '../components/recipes/IngredientCard';
import { IngredientManageSheet } from '../components/recipes/IngredientManageSheet';
import { AddIngredientSheet } from '../components/recipes/AddIngredientSheet';
import { MissingConversionSheet } from '../components/recipes/MissingConversionSheet';
import { IngredientVM } from '../components/recipes/types';
import { computeIngredientsNutrition } from '../utils/nutritionUtils';
import { CollapsibleSection, RichEditorField, SectionLabel, Stepper, UnderlineField } from '../components/ui';

const DEFAULT_INGREDIENT_AMOUNT = 100;

let draftKeyCounter = 0;
function nextDraftKey() {
    return `draft-${++draftKeyCounter}`;
}

function productToDraft(product: Product): IngredientVM {
    return {
        key: nextDraftKey(),
        product_id: product.id,
        is_linked: true,
        name: product.name,
        brand: product.brand,
        grams: DEFAULT_INGREDIENT_AMOUNT,
        input_amount: DEFAULT_INGREDIENT_AMOUNT,
        input_unit: GRAM_UNIT,
        calories: product.calories,
        protein: product.protein,
        fat: product.fat,
        carbs: product.carbs,
        fiber: product.fiber,
        sugar: product.sugar,
        salt: product.salt,
    };
}

function draftToInput(draft: IngredientVM): IngredientInput {
    if (draft.is_linked && draft.product_id) {
        return { product_id: draft.product_id, input_amount: draft.input_amount, input_unit: draft.input_unit };
    }
    return {
        name: draft.name,
        brand: draft.brand,
        input_amount: draft.input_amount,
        input_unit: draft.input_unit,
        calories: draft.calories,
        protein: draft.protein,
        fat: draft.fat,
        carbs: draft.carbs,
        fiber: draft.fiber,
        sugar: draft.sugar,
        salt: draft.salt,
    };
}

export default function AddRecipe() {
    const router = useRouter();
    const { createRecipe } = useRecipeStore();
    const { addProduct } = useProductStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { pick } = usePickProduct();
    const { addProductForRecipe } = useAddProductForRecipe();
    const guard = useUnitConversionGuard();

    const [drafts, setDrafts] = useState<IngredientVM[]>([]);
    const [managedKey, setManagedKey] = useState<string | null>(null);
    const [addSheetOpen, setAddSheetOpen] = useState(false);

    const { control, handleSubmit, watch, formState: { errors } } = useRecipeForm();
    const watchedServings = watch('servings') ?? 1;

    const managedDraft = drafts.find((d) => d.key === managedKey) ?? null;
    const manualCount = drafts.filter((d) => !d.is_linked).length;
    const nutrition = useMemo(() => computeIngredientsNutrition(drafts), [drafts]);

    function updateDraft(key: string, patch: Partial<IngredientVM>) {
        setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
    }

    /** No backend call exists yet to react to (the recipe isn't created until
     * Save), so household-unit conversions are resolved proactively against
     * the saved-conversion cache the moment a unit is picked. */
    async function handleDraftAmountCommit(draft: IngredientVM, newAmount: number) {
        if (!draft.product_id || draft.input_unit === GRAM_UNIT) {
            updateDraft(draft.key, { input_amount: newAmount, grams: newAmount });
            return;
        }
        const gramsPerUnit = await guard.resolveGramsPerUnit(draft.product_id, draft.name, draft.input_unit);
        if (gramsPerUnit == null) return;
        updateDraft(draft.key, { input_amount: newAmount, grams: newAmount * gramsPerUnit });
    }

    async function handleDraftUnitChange(draft: IngredientVM, newUnit: string) {
        if (newUnit === GRAM_UNIT) {
            updateDraft(draft.key, { input_unit: GRAM_UNIT, input_amount: draft.grams });
            return;
        }
        if (!draft.product_id) return;
        const gramsPerUnit = await guard.resolveGramsPerUnit(draft.product_id, draft.name, newUnit);
        if (gramsPerUnit == null) return;
        updateDraft(draft.key, { input_unit: newUnit, grams: draft.input_amount * gramsPerUnit });
    }

    function handleChooseFromLibrary() {
        setAddSheetOpen(false);
        afterSheetClose(async () => {
            const product = await pick();
            if (product) {
                setDrafts((list) => [...list, productToDraft(product)]);
            }
        });
    }

    function handleAddProduct() {
        setAddSheetOpen(false);
        afterSheetClose(async () => {
            const result = await addProductForRecipe();
            if (!result) return;
            if (result.kind === 'library') {
                setDrafts((list) => [...list, productToDraft(result.product)]);
            } else {
                const { name, brand, calories, protein, fat, carbs, fiber, sugar, salt } = result.values;
                setDrafts((list) => [
                    ...list,
                    {
                        key: nextDraftKey(),
                        product_id: null,
                        is_linked: false,
                        name,
                        brand: brand || null,
                        grams: DEFAULT_INGREDIENT_AMOUNT,
                        input_amount: DEFAULT_INGREDIENT_AMOUNT,
                        input_unit: GRAM_UNIT,
                        calories,
                        protein,
                        fat,
                        carbs,
                        fiber,
                        sugar,
                        salt,
                    },
                ]);
            }
        });
    }

    async function onSubmit(data: RecipeFormValues) {
        const recipe = await createRecipe({ ...data, ingredients: drafts.map(draftToInput) });
        router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
    }

    return (
        <>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
                    <Pressable style={styles.saveButton} onPress={handleSubmit(onSubmit)}>
                        <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                </View>

                <CollapsibleSection label="Recipe steps" sublabel="Preparation notes shown on the recipe">
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

                <Controller
                    control={control}
                    name="servings"
                    render={({ field: { onChange, value } }) => (
                        <Stepper label="Servings" value={value ?? 1} onChange={onChange} />
                    )}
                />

                <NutritionSummaryCard
                    perMeal={nutrition.per_meal}
                    per100g={nutrition.per_100g}
                    servings={watchedServings}
                    totalGrams={nutrition.totalGrams}
                    manualCount={manualCount}
                />

                <View style={styles.sectionHeader}>
                    <SectionLabel>{`Ingredients · ${drafts.length}`}</SectionLabel>
                    {manualCount > 0 && <Text style={styles.sectionMeta}>{`${manualCount} not saved`}</Text>}
                </View>

                <Pressable style={styles.addIngredientButton} onPress={() => setAddSheetOpen(true)}>
                    <Text style={styles.addIngredientText}>+ Add ingredient</Text>
                </Pressable>

                {drafts.map((draft) => (
                    <IngredientCard
                        key={draft.key}
                        ingredient={draft}
                        editable
                        onAmountCommit={(amount) => handleDraftAmountCommit(draft, amount)}
                        onUnitChange={(unit) => handleDraftUnitChange(draft, unit)}
                        onMenuPress={() => setManagedKey(draft.key)}
                    />
                ))}
            </ScrollView>

            <IngredientManageSheet
                ingredient={managedDraft}
                onClose={() => setManagedKey(null)}
                onOpenInLibrary={(productId) => {
                    setManagedKey(null);
                    afterSheetClose(() => router.push({ pathname: '/product/[id]', params: { id: productId } }));
                }}
                onSwap={() => {
                    const key = managedDraft?.key;
                    setManagedKey(null);
                    if (!key) return;
                    afterSheetClose(async () => {
                        const product = await pick();
                        if (product) {
                            setDrafts((list) =>
                                list.map((d) =>
                                    d.key === key
                                        ? {
                                              ...d,
                                              product_id: product.id,
                                              is_linked: true,
                                              name: product.name,
                                              brand: product.brand,
                                              calories: product.calories,
                                              protein: product.protein,
                                              fat: product.fat,
                                              carbs: product.carbs,
                                              fiber: product.fiber,
                                              sugar: product.sugar,
                                              salt: product.salt,
                                              // Force back to grams -- a household unit's
                                              // grams-per-unit is product-specific.
                                              input_unit: GRAM_UNIT,
                                              input_amount: d.grams,
                                          }
                                        : d
                                )
                            );
                        }
                    });
                }}
                editValuesAllowedUnits={GRAM_ONLY_UNITS}
                onEditValues={(values) => {
                    if (!managedDraft) return;
                    // Only {product_id, input_amount, input_unit} is sent for linked
                    // drafts on save, so keeping the link would silently discard these
                    // edits -- convert the draft to unlinked instead. Editing values
                    // always uses grams (editValuesAllowedUnits above), consistent with
                    // becoming unlinked.
                    updateDraft(managedDraft.key, {
                        ...values,
                        grams: values.input_amount,
                        product_id: null,
                        is_linked: false,
                    });
                    setManagedKey(null);
                }}
                onUnlink={() => {
                    if (!managedDraft) return;
                    updateDraft(managedDraft.key, {
                        product_id: null,
                        is_linked: false,
                        input_unit: GRAM_UNIT,
                        input_amount: managedDraft.grams,
                    });
                    setManagedKey(null);
                }}
                onAddToLibrary={async () => {
                    if (!managedDraft) return;
                    const product = await addProduct({
                        name: managedDraft.name,
                        brand: managedDraft.brand,
                        calories: managedDraft.calories,
                        protein: managedDraft.protein,
                        fat: managedDraft.fat,
                        carbs: managedDraft.carbs,
                        fiber: managedDraft.fiber,
                        sugar: managedDraft.sugar,
                        salt: managedDraft.salt,
                    });
                    updateDraft(managedDraft.key, { product_id: product.id, is_linked: true });
                    setManagedKey(null);
                }}
                onRemove={() => {
                    if (!managedDraft) return;
                    setDrafts((list) => list.filter((d) => d.key !== managedDraft.key));
                    setManagedKey(null);
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
        titleRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: Spacing.md,
        },
        titleField: { flex: 1 },
        saveButton: {
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: colors.primaryPressed,
            borderRadius: Radii.md,
            paddingVertical: Spacing.xs,
            paddingHorizontal: Spacing.md,
        },
        saveButtonText: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.xs,
            letterSpacing: Typography.letterSpacing.label,
            textTransform: 'uppercase',
            color: colors.onPrimary,
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
    });
}
