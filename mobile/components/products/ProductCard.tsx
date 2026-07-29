import {useThemeColor} from "../../hooks/useThemeColor";
import {memo, useMemo} from "react";
import {StyleSheet, Text, View} from "react-native";
import {ThemeColors} from "../../constants/Colors";
import {Typography} from "../../constants/Typography";
import {useRouter} from "expo-router";
import {Product} from "../../store/productStore";
import {formatMacro} from "../../utils/formatUtils";
import {ProductCardBase} from "./ProductCardBase";

type ProductCardProps = {
    item: Product;
};
export const ProductCard = memo(function ProductCard({ item }: ProductCardProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();

    return (
        <ProductCardBase
            name={item.name}
            brand={item.brand}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
            footer={
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
            }
        />
    );
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
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
