import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ProductFormSchema } from '../../schemas';
import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useProductStore } from '../../store/productStore';
import { SectionLabel, UnderlineField, StatGrid, StatCard, NotesField } from '../../components/ui';

type ProductFormInput = z.input<typeof ProductFormSchema>;
type ProductFormValues = z.output<typeof ProductFormSchema>;

export default function ProductDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { products, loaded, loadProducts, updateProduct } = useProductStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        if (!loaded) {
            loadProducts();
        }
    }, [loaded]);

    const product = products.find((p) => p.id === id);

    const { control, handleSubmit, formState: { errors } } = useForm<ProductFormInput, any, ProductFormValues>({
        resolver: zodResolver(ProductFormSchema),
        defaultValues: {
            name: '',
            brand: '',
            barcode: null,
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fiber: 0,
            sugar: 0,
            salt: 0,
            notes: '',
        },
        values: product
            ? {
                name: product.name,
                brand: product.brand,
                barcode: product.barcode,
                calories: product.calories,
                protein: product.protein,
                fat: product.fat,
                carbs: product.carbs,
                fiber: product.fiber,
                sugar: product.sugar,
                salt: product.salt,
                notes: product.notes,
            }
            : undefined,
    });

    async function onSubmit(data: ProductFormValues) {
        await updateProduct(id, data);
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
            <SectionLabel>Identity</SectionLabel>
            <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                    <UnderlineField
                        label="Name"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.name?.message}
                    />
                )}
            />
            <Controller
                control={control}
                name="brand"
                render={({ field: { onChange, onBlur, value } }) => (
                    <UnderlineField
                        label="Brand"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.brand?.message}
                    />
                )}
            />
            <Controller
                control={control}
                name="barcode"
                render={({ field: { value } }) => (
                    <UnderlineField
                        label="Barcode"
                        value={value || '0000000000000'}
                        editable={false}
                        valueFontFamily="mono"
                    />
                )}
            />

            <SectionLabel style={styles.sectionSpacing}>Macronutrients (per 100g)</SectionLabel>
            <StatGrid columns={2}>
                <Controller
                    control={control}
                    name="calories"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Calories" unit="kcal" value={value as number | null} onChangeValue={onChange} size="lg" />
                    )}
                />
                <Controller
                    control={control}
                    name="protein"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Protein" unit="g" value={value as number | null} onChangeValue={onChange} size="lg" />
                    )}
                />
                <Controller
                    control={control}
                    name="fat"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Fat" unit="g" value={value as number | null} onChangeValue={onChange} size="lg" />
                    )}
                />
                <Controller
                    control={control}
                    name="carbs"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Carbs" unit="g" value={value as number | null} onChangeValue={onChange} size="lg" />
                    )}
                />
            </StatGrid>

            <SectionLabel style={styles.sectionSpacing}>Detail (per 100g)</SectionLabel>
            <StatGrid columns={3}>
                <Controller
                    control={control}
                    name="fiber"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Fiber" unit="g" value={value as number | null} onChangeValue={onChange} size="sm" />
                    )}
                />
                <Controller
                    control={control}
                    name="sugar"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Sugar" unit="g" value={value as number | null} onChangeValue={onChange} size="sm" />
                    )}
                />
                <Controller
                    control={control}
                    name="salt"
                    render={({ field: { onChange, value } }) => (
                        <StatCard label="Salt" unit="g" value={value as number | null} onChangeValue={onChange} size="sm" />
                    )}
                />
            </StatGrid>

            <SectionLabel style={styles.sectionSpacing}>Notes</SectionLabel>
            <Controller
                control={control}
                name="notes"
                render={({ field: { onChange, onBlur, value } }) => (
                    <NotesField value={value ?? ''} onChangeText={onChange} onBlur={onBlur} />
                )}
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
        sectionSpacing: {
            marginTop: Spacing.lg,
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
