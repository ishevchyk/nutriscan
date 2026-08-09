import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useProductForm, ProductFormValues } from '../../hooks/useProductForm';
import { useProductStore } from '../../store/productStore';
import { useGroupStore } from '../../store/groupStore';
import { ProductFormFields } from '../../components/products/ProductFormFields';

export default function ProductDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { products, loaded, loadProducts, updateProduct, removeProduct, assignProductToGroups, removeProductFromGroup } = useProductStore();
    const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

    useEffect(() => {
        if (!loaded) {
            loadProducts();
        }
    }, [loaded]);

    useEffect(() => {
        if (!groupsLoaded) {
            fetchGroups();
        }
    }, [groupsLoaded]);

    const product = products.find((p) => p.id === id);

    useEffect(() => {
        if (product) {
            setSelectedGroupIds(product.groups.map((g) => g.id));
        }
    }, [product?.id]);

    const { control, handleSubmit, formState: { errors } } = useProductForm(product);

    function toggleGroup(groupId: string) {
        setSelectedGroupIds((ids) => (ids.includes(groupId) ? ids.filter((i) => i !== groupId) : [...ids, groupId]));
    }

    async function onSubmit(data: ProductFormValues) {
        await updateProduct(id, data);

        const currentGroupIds = product?.groups.map((g) => g.id) ?? [];
        const toRemove = currentGroupIds.filter((gid) => !selectedGroupIds.includes(gid));
        await Promise.all(toRemove.map((gid) => removeProductFromGroup(id, gid)));
        if (selectedGroupIds.length > 0) {
            await assignProductToGroups(id, selectedGroupIds);
        }

        router.back();
    }

    async function onDelete() {
        await removeProduct(id);
        router.back();
    }

    if (loaded && !product) {
        return (
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.notFound}>Product not found.</Text>
            </ScrollView>
        );
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
            <Pressable style={styles.button} onPress={onDelete}>
                <Text style={styles.buttonText}>Delete</Text>
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
        notFound: {
            color: colors.textSecondary,
            fontSize: Typography.fontSize.base,
            textAlign: 'center',
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
