import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useNutritionBasis } from '../hooks/useNutritionBasis';
import { useProductForm, ProductFormValues } from '../hooks/useProductForm';
import { useProductStore } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { usePickerStore } from '../store/pickerStore';
import { ProductFormFields } from '../components/products/ProductFormFields';
import { CatalogDraftBanner } from '../components/catalog/CatalogDraftBanner';
import { CatalogDraft, useCatalogStore } from '../store/catalogStore';

export default function AddProduct() {
    const router = useRouter();
    const { forMeal, libraryOnly, name } = useLocalSearchParams<{ forMeal?: string; libraryOnly?: string; name?: string }>();
    const isForMeal = forMeal === '1';
    // The product picker reuses for-meal mode to get the saved product back,
    // but only meals can keep a product out of the library.
    const allowMealOnly = isForMeal && libraryOnly !== '1';
    const { addProduct, assignProductToGroups, addPortion } = useProductStore();
    const basis = useNutritionBasis([]);
    const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    useEffect(() => {
        if (!groupsLoaded) {
            fetchGroups();
        }
    }, [groupsLoaded]);

    // Resolves the addProductForMeal() promise with null if the screen is
    // dismissed (e.g. swipe-back) without an explicit save action.
    useEffect(() => {
        if (!isForMeal) return;
        return () => {
            if (usePickerStore.getState().addProductResolver) {
                usePickerStore.getState().resolveAddProduct(null);
            }
        };
    }, [isForMeal]);

    const { control, handleSubmit, reset, setValue, formState: { errors } } = useProductForm(undefined, name);
    const [saving, setSaving] = useState(false);

    // Catalog search / barcode scan screens sit on top of this one (so the
    // meal-picker resolver above stays alive) and hand their result back here.
    const incomingDraft = useCatalogStore((s) => s.draft);
    const prefillBarcode = useCatalogStore((s) => s.prefillBarcode);
    const [catalogDraft, setCatalogDraft] = useState<CatalogDraft | null>(null);

    useEffect(() => {
        if (!incomingDraft) return;
        reset({
            name: incomingDraft.name,
            brand: incomingDraft.brand ?? '',
            barcode: incomingDraft.barcode,
            calories: incomingDraft.calories,
            protein: incomingDraft.protein,
            fat: incomingDraft.fat,
            carbs: incomingDraft.carbs,
            fiber: incomingDraft.fiber,
            sugar: incomingDraft.sugar,
            salt: incomingDraft.salt,
            saturated_fat: incomingDraft.saturated_fat,
            nutrients: incomingDraft.nutrients,
            notes: incomingDraft.notes ?? '',
        });
        setSelectedGroupIds(incomingDraft.suggested_group_id ? [incomingDraft.suggested_group_id] : []);
        setCatalogDraft(incomingDraft);
        useCatalogStore.getState().setDraft(null);
    }, [incomingDraft]);

    useEffect(() => {
        if (!prefillBarcode) return;
        setValue('barcode', prefillBarcode);
        useCatalogStore.getState().setPrefillBarcode(null);
    }, [prefillBarcode]);

    function toggleGroup(groupId: string) {
        setSelectedGroupIds((ids) => (ids.includes(groupId) ? ids.filter((i) => i !== groupId) : [...ids, groupId]));
    }

    async function onSubmit(data: ProductFormValues) {
        if (saving) return;
        setSaving(true);
        try {
            let product;
            if (catalogDraft) {
                // One transaction on the server: product + portions + nutrients + groups.
                product = await useCatalogStore.getState().importProduct({
                    ...data,
                    barcode: data.barcode ?? catalogDraft.barcode,
                    portions: catalogDraft.portions,
                    group_ids: selectedGroupIds,
                });
            } else {
                product = await addProduct(data);
                if (basis.newPortion) {
                    await addPortion(product.id, { ...basis.newPortion, is_default: true });
                }
                if (selectedGroupIds.length > 0) {
                    await assignProductToGroups(product.id, selectedGroupIds);
                }
            }
            if (isForMeal) {
                usePickerStore.getState().resolveAddProduct({ kind: 'library', product });
            }
            router.back();
        } finally {
            setSaving(false);
        }
    }

    function onSubmitMealOnly(data: ProductFormValues) {
        if (saving) return;
        usePickerStore.getState().resolveAddProduct({ kind: 'mealOnly', values: data });
        router.back();
    }

    return (
        <ScrollView style={{ backgroundColor: colors.pageBackground }} contentContainerStyle={styles.container}>
            {catalogDraft ? (
                <CatalogDraftBanner draft={catalogDraft} />
            ) : (
                <View style={styles.entryRow}>
                    <Pressable style={styles.entryButton} onPress={() => router.push('/catalog-search')}>
                        <Text style={styles.entryText}>Search public catalog</Text>
                    </Pressable>
                    <Pressable style={styles.entryButton} onPress={() => router.push('/barcode-scan')}>
                        <Text style={styles.entryText}>Scan barcode</Text>
                    </Pressable>
                </View>
            )}

            <ProductFormFields
                control={control}
                errors={errors}
                groups={groups}
                selectedGroupIds={selectedGroupIds}
                onToggleGroup={toggleGroup}
                basis={basis}
            />

            <Pressable
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={saving}
            >
                {saving ? (
                    <ActivityIndicator color={colors.onPrimary} />
                ) : (
                    <Text style={styles.buttonText}>{allowMealOnly && !catalogDraft ? 'Save to Library' : 'Save'}</Text>
                )}
            </Pressable>

            {allowMealOnly && !catalogDraft && (
                <Pressable
                    style={[styles.secondaryButton, saving && styles.buttonDisabled]}
                    onPress={handleSubmit(onSubmitMealOnly)}
                    disabled={saving}
                >
                    <Text style={styles.secondaryButtonText}>Save to meal only</Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            padding: Spacing.xl,
            backgroundColor: colors.pageBackground,
            gap: Spacing.sm,
        },
        button: {
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: colors.primaryPressed,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
            marginTop: Spacing.lg,
        },
        buttonText: {
            color: colors.onPrimary,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
        entryRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            marginBottom: Spacing.md,
        },
        entryButton: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.primary,
            borderStyle: 'dashed',
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        entryText: {
            color: colors.primary,
            fontSize: Typography.fontSize.sm,
            fontWeight: Typography.fontWeight.semibold,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        secondaryButton: {
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        secondaryButtonText: {
            color: colors.primary,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
    });
}
