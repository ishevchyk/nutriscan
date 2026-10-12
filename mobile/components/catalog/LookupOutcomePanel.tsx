import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemeColors } from '../../constants/Colors';
import { Radii } from '../../constants/Radii';
import { Spacing } from '../../constants/Spacing';
import { Typography } from '../../constants/Typography';
import { LookupState } from '../../hooks/useCatalogLookup';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useCatalogStore } from '../../store/catalogStore';
import { useProductStore } from '../../store/productStore';
import { catalogErrorMessage } from '../../utils/catalogErrors';

type Props = {
    state: LookupState;
    onRetry: (code: string) => void;
    /** Back to the scanner / result list. */
    onDismiss: () => void;
    /**
     * Phase 6 hook: "Scan the nutrition label with AI" (the Claude Vision
     * fallback when OFF has no match). Offered on the not-found card only when
     * a handler is supplied -- nothing passes one until Phase 6 ships.
     */
    onScanLabelWithAI?: () => void;
};

export function LookupOutcomePanel({ state, onRetry, onDismiss, onScanLabelWithAI }: Props) {
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const router = useRouter();
    const [restoring, setRestoring] = useState(false);

    if (state.kind === 'idle') return null;
    if (state.kind === 'loading') {
        return (
            <View style={styles.panel}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.body}>Looking it up…</Text>
            </View>
        );
    }

    function openManually(code: string) {
        useCatalogStore.getState().setPrefillBarcode(code);
        router.back();
    }

    async function onRestore(productId: string) {
        setRestoring(true);
        try {
            await useProductStore.getState().restoreProduct(productId);
            router.replace(`/product/${productId}`);
        } catch {
            setRestoring(false);
        }
    }

    if (state.kind === 'inLibrary') {
        return (
            <View style={styles.panel}>
                <Text style={styles.title}>{state.name}</Text>
                <Text style={styles.body}>
                    {state.deleted ? 'This product is in your deleted items.' : 'Already in your library.'}
                </Text>
                {state.deleted ? (
                    <Pressable style={[styles.primary, restoring && styles.disabled]} disabled={restoring} onPress={() => onRestore(state.productId)}>
                        <Text style={styles.primaryText}>Restore</Text>
                    </Pressable>
                ) : (
                    <Pressable style={styles.primary} onPress={() => router.replace(`/product/${state.productId}`)}>
                        <Text style={styles.primaryText}>Open product</Text>
                    </Pressable>
                )}
                <Pressable style={styles.secondary} onPress={onDismiss}>
                    <Text style={styles.secondaryText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    if (state.kind === 'notFound') {
        return (
            <View style={styles.panel}>
                <Text style={styles.title}>Not in Open Food Facts</Text>
                <Text style={styles.body}>Barcode {state.code} isn't in the public catalog yet.</Text>
                <Pressable style={styles.primary} onPress={() => openManually(state.code)}>
                    <Text style={styles.primaryText}>Enter manually</Text>
                </Pressable>
                {onScanLabelWithAI && (
                    <Pressable style={styles.secondary} onPress={onScanLabelWithAI}>
                        <Text style={styles.secondaryText}>Scan the nutrition label with AI</Text>
                    </Pressable>
                )}
                <Pressable style={styles.secondary} onPress={onDismiss}>
                    <Text style={styles.secondaryText}>Scan another</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.panel}>
            <Text style={styles.body}>{catalogErrorMessage(state.error)}</Text>
            <Pressable style={styles.primary} onPress={() => onRetry(state.code)}>
                <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => openManually(state.code)}>
                <Text style={styles.secondaryText}>Add manually</Text>
            </Pressable>
        </View>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        panel: {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.xl,
            padding: Spacing.xl,
            gap: Spacing.md,
            alignItems: 'stretch',
        },
        title: {
            color: colors.text,
            fontSize: Typography.fontSize.lg,
            fontWeight: Typography.fontWeight.semibold,
        },
        body: { color: colors.textSecondary, fontSize: Typography.fontSize.base, textAlign: 'center' },
        primary: {
            backgroundColor: colors.primary,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        primaryText: {
            color: colors.onPrimary,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
        secondary: {
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.md,
            alignItems: 'center',
        },
        secondaryText: {
            color: colors.primary,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
        disabled: { opacity: 0.6 },
    });
}
