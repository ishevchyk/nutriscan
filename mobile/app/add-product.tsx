import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProductForm, ProductFormValues } from '../hooks/useProductForm';
import { useProductStore } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { usePickerStore } from '../store/pickerStore';
import { ProductFormFields } from '../components/products/ProductFormFields';

export default function AddProduct() {
    const router = useRouter();
    const { forRecipe } = useLocalSearchParams<{ forRecipe?: string }>();
    const isForRecipe = forRecipe === '1';
    const { addProduct, assignProductToGroups } = useProductStore();
    const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    useEffect(() => {
        if (!groupsLoaded) {
            fetchGroups();
        }
    }, [groupsLoaded]);

    // Resolves the addProductForRecipe() promise with null if the screen is
    // dismissed (e.g. swipe-back) without an explicit save action.
    useEffect(() => {
        if (!isForRecipe) return;
        return () => {
            if (usePickerStore.getState().addProductResolver) {
                usePickerStore.getState().resolveAddProduct(null);
            }
        };
    }, [isForRecipe]);

    const { control, handleSubmit, formState: { errors } } = useProductForm();

    function toggleGroup(groupId: string) {
        setSelectedGroupIds((ids) => (ids.includes(groupId) ? ids.filter((i) => i !== groupId) : [...ids, groupId]));
    }

    async function onSubmit(data: ProductFormValues) {
        const product = await addProduct(data);
        if (selectedGroupIds.length > 0) {
            await assignProductToGroups(product.id, selectedGroupIds);
        }
        if (isForRecipe) {
            usePickerStore.getState().resolveAddProduct({ kind: 'library', product });
        }
        router.back();
    }

    function onSubmitRecipeOnly(data: ProductFormValues) {
        usePickerStore.getState().resolveAddProduct({ kind: 'recipeOnly', values: data });
        router.back();
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <ProductFormFields
                control={control}
                errors={errors}
                groups={isForRecipe ? [] : groups}
                selectedGroupIds={selectedGroupIds}
                onToggleGroup={toggleGroup}
            />

            <Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.buttonText}>{isForRecipe ? 'Save to Library' : 'Save'}</Text>
            </Pressable>

            {isForRecipe && (
                <Pressable style={styles.secondaryButton} onPress={handleSubmit(onSubmitRecipeOnly)}>
                    <Text style={styles.secondaryButtonText}>Save to recipe only</Text>
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
