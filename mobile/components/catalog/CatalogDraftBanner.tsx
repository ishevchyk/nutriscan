import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../../constants/Colors';
import { Radii } from '../../constants/Radii';
import { Spacing } from '../../constants/Spacing';
import { Typography } from '../../constants/Typography';
import { useThemeColor } from '../../hooks/useThemeColor';
import { CatalogDraft } from '../../store/catalogStore';
import { formatAmount } from '../../utils/formatUtils';
import { OffAttribution } from './OffAttribution';

const COMPLETENESS_NOTE: Record<CatalogDraft['completeness'], string | null> = {
    complete: null,
    partial: 'Some values are missing on Open Food Facts. Check the pack and fill them in before saving.',
    no_nutrition: 'Open Food Facts has no nutrition data for this product. Enter it from the pack before saving.',
};

/** Shown at the top of Add Product while a catalog draft is loaded into the form. */
export function CatalogDraftBanner({ draft }: { draft: CatalogDraft }) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const note = COMPLETENESS_NOTE[draft.completeness];
    // Product weights stay in grams app-wide (units setting only affects body stats).
    const portion = draft.portions[0];

    return (
        <View style={styles.banner}>
            <Text style={styles.title}>Imported from Open Food Facts</Text>
            <Text style={styles.body}>Review the values below, then save to add it to your library.</Text>
            {note && <Text style={[styles.body, styles.warning]}>{note}</Text>}
            {portion && (
                <Text style={styles.body}>
                    Default portion: {portion.name} ({formatAmount(portion.grams)} g)
                </Text>
            )}
            <OffAttribution url={draft.off_url} />
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        banner: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            padding: Spacing.lg,
            gap: Spacing.xs,
            marginBottom: Spacing.md,
        },
        title: { color: colors.text, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
        body: { color: colors.textSecondary, fontSize: Typography.fontSize.sm },
        warning: { color: colors.error },
    });
}
