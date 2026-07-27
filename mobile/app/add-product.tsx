import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { Radii, Spacing, ThemeColors, Typography } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProductForm, ProductFormValues } from '../hooks/useProductForm';
import { useProductStore } from '../store/productStore';
import { ProductFormFields } from '../components/products/ProductFormFields';

export default function AddProduct() {
    const router = useRouter();
    const addProduct = useProductStore((state) => state.addProduct);
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { control, handleSubmit, formState: { errors } } = useProductForm();

    async function onSubmit(data: ProductFormValues) {
        await addProduct(data);
        router.back();
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <ProductFormFields control={control} errors={errors} />

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
