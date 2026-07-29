import { memo, ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../constants/Colors';
import { Radii } from '../../constants/Radii';
import { Spacing } from '../../constants/Spacing';
import { Typography } from '../../constants/Typography';
import { useThemeColor } from '../../hooks/useThemeColor';

type ProductCardBaseProps = {
    name: string;
    brand?: string | null;
    onPress?: () => void;
    footer: ReactNode;
};

export const ProductCardBase = memo(function ProductCardBase({ name, brand, onPress, footer }: ProductCardBaseProps) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const content = (
        <View style={styles.card}>
            <View style={styles.label}>
                <Text style={styles.labelName}>{name}</Text>
                {brand ? <Text style={styles.labelBrand}>{brand}</Text> : null}
            </View>
            {footer}
        </View>
    );

    return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
});

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            padding: Spacing.lg,
            gap: Spacing.sm,
            marginBottom: Spacing.md,
        },
        label: {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingBottom: Spacing.sm,
        },
        labelName: {
            fontSize: Typography.fontSize.sm,
            fontWeight: Typography.fontWeight.medium,
            color: colors.text,
        },
        labelBrand: {
            fontSize: Typography.fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2,
        },
    });
}
