import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useNutritionBasis } from '../hooks/useNutritionBasis';
import { useProductForm, ProductFormValues } from '../hooks/useProductForm';
import { useProductStore } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { usePickerStore } from '../store/pickerStore';
import { ProductFormFields } from '../components/products/ProductFormFields';

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

    const { control, handleSubmit, formState: { errors } } = useProductForm(undefined, name);
    const [saving, setSaving] = useState(false);

    function toggleGroup(groupId: string) {
        setSelectedGroupIds((ids) => (ids.includes(groupId) ? ids.filter((i) => i !== groupId) : [...ids, groupId]));
    }

    async function onSubmit(data: ProductFormValues) {
        if (saving) return;
        setSaving(true);
        try {
            const product = await addProduct(data);
            if (basis.newPortion) {
                await addPortion(product.id, { ...basis.newPortion, is_default: true });
            }
            if (selectedGroupIds.length > 0) {
                await assignProductToGroups(product.id, selectedGroupIds);
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
                    <Text style={styles.buttonText}>{allowMealOnly ? 'Save to Library' : 'Save'}</Text>
                )}
            </Pressable>

            {allowMealOnly && (
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
