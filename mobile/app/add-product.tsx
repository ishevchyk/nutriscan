import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProductForm, ProductFormValues } from '../hooks/useProductForm';
import { useProductStore } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { ProductFormFields } from '../components/products/ProductFormFields';

export default function AddProduct() {
    const router = useRouter();
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

    const { control, handleSubmit, formState: { errors } } = useProductForm();

    function toggleGroup(groupId: string) {
        setSelectedGroupIds((ids) => (ids.includes(groupId) ? ids.filter((i) => i !== groupId) : [...ids, groupId]));
    }

    async function onSubmit(data: ProductFormValues) {
        const product = await addProduct(data);
        if (selectedGroupIds.length > 0) {
            await assignProductToGroups(product.id, selectedGroupIds);
        }
        router.back();
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <ProductFormFields
                control={control}
                errors={errors}
                groups={groups}
                selectedGroupIds={selectedGroupIds}
                onToggleGroup={toggleGroup}
            />

            <Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.buttonText}>Save</Text>
            </Pressable>
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
    });
}
