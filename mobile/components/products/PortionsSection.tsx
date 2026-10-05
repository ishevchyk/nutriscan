import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Product, useProductStore } from '../../store/productStore';
import { SectionLabel } from '../ui';
import { formatAmount } from '../../utils/formatUtils';

/** Saved portions ("1 bar" = 52 g): set the default or delete. New portions are
 * added with the "+ PORTION" chip in the nutrition section. Writes go straight
 * to the API and show in the autosave indicator via `onTrack`. */
export function PortionsSection({
    product,
    onTrack,
}: {
    product: Product;
    onTrack?: <T>(task: () => Promise<T>) => Promise<T | undefined>;
}) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { updatePortion, removePortion } = useProductStore();
    const track = <T,>(task: () => Promise<T>) => (onTrack ? onTrack(task) : task());
    return (
        <>
            <View style={styles.header}>
                <SectionLabel style={styles.label}>Portions</SectionLabel>
                <Text style={styles.count}>{product.portions.length}</Text>
            </View>
            <View style={styles.card}>
                {product.portions.length === 0 && (
                    <Text style={styles.empty}>No portions yet. Use "+ PORTION" above to add one and log by count instead of grams.</Text>
                )}
                {product.portions.map((p) => (
                    <View key={p.id} style={styles.portionRow}>
                        <View style={styles.flex}>
                            <Text style={styles.portionName}>{p.name}</Text>
                            <Text style={styles.portionSub}>
                                {formatAmount(p.grams)} G
                                {product.calories != null ? ` · ${Math.round((product.calories * p.grams) / 100)} KCAL` : ''}
                            </Text>
                        </View>
                        <Pressable
                            style={[styles.pill, p.is_default && styles.pillOn]}
                            onPress={() => track(() => updatePortion(product.id, p.id, { is_default: !p.is_default }))}
                        >
                            <Text style={[styles.pillText, p.is_default && styles.pillTextOn]}>
                                {p.is_default ? 'DEFAULT' : 'SET DEFAULT'}
                            </Text>
                        </Pressable>
                        <Pressable onPress={() => track(() => removePortion(product.id, p.id))} hitSlop={8} accessibilityLabel="Delete portion">
                            <Text style={styles.remove}>×</Text>
                        </Pressable>
                    </View>
                ))}
            </View>
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1 },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: Spacing.xl,
            marginBottom: Spacing.sm,
        },
        label: { marginBottom: 0 },
        count: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xs,
            color: colors.textSecondary,
        },
        card: {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.xl,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.lg,
        },
        empty: { paddingVertical: Spacing.lg, fontSize: Typography.fontSize.base, color: colors.textSecondary },
        portionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            paddingVertical: Spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        portionName: { fontSize: Typography.fontSize.lg, color: colors.text },
        portionSub: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xs,
            color: colors.textSecondary,
            marginTop: 2,
        },
        pill: {
            borderRadius: Radii.full,
            paddingVertical: 6,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
        },
        pillOn: { backgroundColor: colors.primary, borderColor: colors.primaryPressed },
        pillText: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.xxs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textSecondary,
        },
        pillTextOn: { color: colors.onPrimary },
        remove: { fontSize: 24, color: colors.textTertiary, paddingHorizontal: Spacing.xs },
    });
}
