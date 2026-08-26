import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { useThemeColor } from '../../hooks/useThemeColor';
import { formatMacro } from '../../utils/formatUtils';

type ProductMacroFooterProps = {
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
};

export function ProductMacroFooter({ calories, protein, fat, carbs }: ProductMacroFooterProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.unitsRow}>
            <View style={styles.unit}>
                <Text style={styles.unitValue}>{formatMacro(calories)}</Text>
                <Text style={styles.unitLabel}>KCAL</Text>
            </View>
            <View style={styles.unit}>
                <Text style={styles.unitValue}>{formatMacro(protein)}</Text>
                <Text style={styles.unitLabel}>P</Text>
            </View>
            <View style={styles.unit}>
                <Text style={styles.unitValue}>{formatMacro(fat)}</Text>
                <Text style={styles.unitLabel}>F</Text>
            </View>
            <View style={styles.unit}>
                <Text style={styles.unitValue}>{formatMacro(carbs)}</Text>
                <Text style={styles.unitLabel}>C</Text>
            </View>
        </View>
    );
}

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
