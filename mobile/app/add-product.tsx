import {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput} from "react-native";
import {useRouter} from "expo-router";
import {ProductFormSchema} from "../schemas";
import {useForm, Controller} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {Radii, Spacing, ThemeColors, Typography} from "../constants/theme";
import {useThemeColor} from "../hooks/useThemeColor";
import {useProductStore} from "../store/productStore";

type ProductFormInput = z.input<typeof ProductFormSchema>;
type ProductFormValues = z.output<typeof ProductFormSchema>;

export default function AddProduct() {
    const router = useRouter();
    const addProduct = useProductStore(state => state.addProduct);
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {control, handleSubmit, formState: {errors}} = useForm<ProductFormInput, any, ProductFormValues>({
        resolver: zodResolver(ProductFormSchema),
        defaultValues: {
            name: "",
            brand: "",
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
            fiber: 0,
            sugar: 0,
            salt: 0,
        },
    });

    async function onSubmit(data: ProductFormValues) {
        await addProduct(data);
        router.back();
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Controller
                control={control}
                name="name"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product name"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value}
                    />
                )}
            />
            {errors.name && <Text style={styles.error}>{errors.name.message}</Text>}
            <Controller
                control={control}
                name="brand"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product brand"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={value ? value : ""}
                    />
                )}
            />
            {errors.brand && <Text style={styles.error}>{errors.brand.message}</Text>}
            <Controller
                control={control}
                name="calories"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product calories"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.calories && <Text style={styles.error}>{errors.calories.message}</Text>}
            <Controller
                control={control}
                name="protein"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product protein"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.protein && <Text style={styles.error}>{errors.protein.message}</Text>}
            <Controller
                control={control}
                name="fat"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product fat"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.fat && <Text style={styles.error}>{errors.fat.message}</Text>}
            <Controller
                control={control}
                name="carbs"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product carbs"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.carbs && <Text style={styles.error}>{errors.carbs.message}</Text>}
            <Controller
                control={control}
                name="fiber"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product fiber"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.fiber && <Text style={styles.error}>{errors.fiber.message}</Text>}
            <Controller
                control={control}
                name="sugar"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product sugar"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.sugar && <Text style={styles.error}>{errors.sugar.message}</Text>}
            <Controller
                control={control}
                name="salt"
                render={({field: {onChange, onBlur, value}}) => (
                    <TextInput
                        style={styles.input}
                        placeholder="Product salt"
                        placeholderTextColor={colors.placeholder}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        value={String(value)}
                    />
                )}
            />
            {errors.salt && <Text style={styles.error}>{errors.salt.message}</Text>}
            <Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
                <Text style={styles.buttonText}>Save</Text>
            </Pressable>
        </ScrollView>
    )
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            padding: Spacing.xl,
            backgroundColor: colors.background,
            gap: Spacing.sm,
        },
        input: {
            backgroundColor: colors.surface,
            borderWidth: 0,
            borderRadius: Radii.lg,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            fontSize: Typography.fontSize.base,
            color: colors.text,
        },
        error: {
            color: colors.error,
            fontSize: Typography.fontSize.sm,
        },
        button: {
            backgroundColor: colors.primary,
            borderWidth: 1,
            borderColor: colors.primaryPressed,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
            marginTop: Spacing.xs,
        },
        buttonText: {
            color: colors.onPrimary,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
    });
}
