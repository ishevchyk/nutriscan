import {useThemeColor} from "../../hooks/useThemeColor";
import {memo, useMemo} from "react";
import {Pressable, StyleSheet, Text, View} from "react-native";
import {ThemeColors} from "../../constants/Colors";
import {Radii} from "../../constants/Radii";
import {Spacing} from "../../constants/Spacing";
import {Typography} from "../../constants/Typography";
import {useRouter} from "expo-router";
import {Product} from "../../store/productStore";
import {formatMacro} from "../../utils/formatUtils";

type ProductCardProps = {
    item: Product;
};
export const ProductCard = memo(function ProductCard({ item }: ProductCardProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    return (
        <Pressable onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}>
            <View style={styles.card}>
                <View style={styles.label}>
                    <Text style={styles.labelName}>{item.name}</Text>
                    {item.brand ? <Text style={styles.labelBrand}>{item.brand}</Text> : null}
                </View>
                <View style={styles.unitsRow}>
                    <View style={styles.unit}>
                        <Text style={styles.unitValue}>{formatMacro(item.calories)}</Text>
                        <Text style={styles.unitLabel}>KCAL</Text>
                    </View>
                    <View style={styles.unit}>
                        <Text style={styles.unitValue}>{formatMacro(item.protein)}</Text>
                        <Text style={styles.unitLabel}>P</Text>
                    </View>
                    <View style={styles.unit}>
                        <Text style={styles.unitValue}>{formatMacro(item.fat)}</Text>
                        <Text style={styles.unitLabel}>F</Text>
                    </View>
                    <View style={styles.unit}>
                        <Text style={styles.unitValue}>{formatMacro(item.carbs)}</Text>
                        <Text style={styles.unitLabel}>C</Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            flex: 1,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            padding: Spacing.lg,
            justifyContent: 'space-between',
            minHeight: 96,
            gap: Spacing.sm,
            marginBottom: Spacing.md,
        },

        label: {
            flex: 1,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: Spacing.sm,
        },

        labelName: {
            fontSize: Typography.fontSize.sm,
            fontWeight: Typography.fontWeight.medium,
            color: colors.text
        },
        labelBrand: {
            fontSize: Typography.fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2
        },

        unitsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
        },

        unit: {
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
        },

        unitLabel: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xxs,
            color: colors.textTertiary,
        },
        unitValue: {
            fontFamily: Typography.fontFamily.monoBold,
            fontSize: Typography.fontSize.xs,
            color: colors.text,
        },
    });
}
