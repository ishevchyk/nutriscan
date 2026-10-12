import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';

import { ThemeColors } from '../../constants/Colors';
import { OFF_WEBSITE_URL } from '../../constants/env';
import { Spacing } from '../../constants/Spacing';
import { Typography } from '../../constants/Typography';
import { useThemeColor } from '../../hooks/useThemeColor';

/** Required wherever Open Food Facts data appears (ODbL / CC BY-SA). */
export function OffAttribution({ url = OFF_WEBSITE_URL, label = 'Data from Open Food Facts' }: { url?: string; label?: string }) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.text}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        text: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xxs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textSecondary,
            textDecorationLine: 'underline',
            textAlign: 'center',
            paddingVertical: Spacing.md,
        },
    });
}
