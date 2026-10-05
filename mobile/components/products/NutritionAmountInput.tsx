import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { formatValue, sanitizeDecimalInput } from '../../utils/formatUtils';

type Props = {
    value: number | null;
    onChangeValue: (value: number | null) => void;
    onBlur?: () => void;
    unit: string;
    testID?: string;
};

/** Compact inline numeric input for a breakdown row. Empty = null (unknown),
 * never 0 -- "0" has to be typed to mean a measured zero. */
export function NutritionAmountInput({ value, onChangeValue, onBlur, unit, testID }: Props) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [text, setText] = useState(formatValue(value));

    useEffect(() => {
        setText(formatValue(value));
    }, [value]);

    function handleChangeText(raw: string) {
        const cleaned = sanitizeDecimalInput(raw);
        setText(cleaned);
        if (cleaned === '' || cleaned === '.') {
            onChangeValue(null);
            return;
        }
        const parsed = Number(cleaned);
        onChangeValue(Number.isNaN(parsed) ? null : parsed);
    }

    return (
        <View style={styles.wrap}>
            <TextInput
                style={styles.input}
                value={text}
                onChangeText={handleChangeText}
                onBlur={onBlur}
                placeholder="—"
                placeholderTextColor={colors.placeholder}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                textAlign="right"
                testID={testID}
            />
            <Text style={styles.unit}>{unit}</Text>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        wrap: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: Spacing.xs,
            minWidth: 88,
            justifyContent: 'flex-end',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        input: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.sm,
            color: colors.text,
            padding: 0,
            minWidth: 48,
        },
        unit: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xs,
            color: colors.textSecondary,
        },
    });
}
