import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useProductForm, ProductFormValues } from '../../hooks/useProductForm';
import { useProductStore } from '../../store/productStore';
import { ProductFormFields } from '../../components/products/ProductFormFields';

export default function ProductDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { products, loaded, loadProducts, updateProduct, removeProduct } = useProductStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        if (!loaded) {
            loadProducts();
        }
    }, [loaded]);

    const product = products.find((p) => p.id === id);

    const { control, handleSubmit, formState: { errors } } = useProductForm(product);

    async function onSubmit(data: ProductFormValues) {
        await updateProduct(id, data);
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
            <ProductFormFields control={control} errors={errors} />

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
