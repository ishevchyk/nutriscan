import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LookupOutcomePanel } from '../components/catalog/LookupOutcomePanel';
import { OffAttribution } from '../components/catalog/OffAttribution';
import { ThemeColors } from '../constants/Colors';
import { Radii } from '../constants/Radii';
import { Spacing } from '../constants/Spacing';
import { Typography } from '../constants/Typography';
import { useCatalogLookup } from '../hooks/useCatalogLookup';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useThemeColor } from '../hooks/useThemeColor';
import { CatalogHit, useCatalogStore } from '../store/catalogStore';
import { CatalogError, catalogErrorMessage, parseCatalogError } from '../utils/catalogErrors';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 600;

type SearchState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'results'; items: CatalogHit[]; page: number; hasMore: boolean; loadingMore: boolean }
    | { kind: 'error'; error: CatalogError };

export default function CatalogSearch() {
    const router = useRouter();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { state: lookupState, lookup, reset } = useCatalogLookup();
    const [text, setText] = useState('');
    const [state, setState] = useState<SearchState>({ kind: 'idle' });
    const debounced = useDebouncedValue(text.trim(), DEBOUNCE_MS);
    // Guards against a slow earlier response overwriting a newer query's results.
    const requestId = useRef(0);
    const lastQuery = useRef('');

    const runSearch = useCallback(async (q: string, page = 1) => {
        if (q.length < MIN_QUERY_LENGTH) return;
        const id = ++requestId.current;
        if (page === 1) setState({ kind: 'loading' });
        else setState((s) => (s.kind === 'results' ? { ...s, loadingMore: true } : s));
        try {
            const result = await useCatalogStore.getState().search(q, page);
            if (id !== requestId.current) return;
            setState((s) => ({
                kind: 'results',
                items: page > 1 && s.kind === 'results' ? [...s.items, ...result.items] : result.items,
                page: result.page,
                hasMore: result.has_more,
                loadingMore: false,
            }));
        } catch (err) {
            if (id === requestId.current) setState({ kind: 'error', error: parseCatalogError(err) });
        }
    }, []);

    // Auto-search after the user pauses typing; never per keystroke. Submitting
    // searches immediately, and lastQuery stops the debounce repeating it.
    useEffect(() => {
        if (debounced.length >= MIN_QUERY_LENGTH && debounced !== lastQuery.current) {
            lastQuery.current = debounced;
            runSearch(debounced);
        }
    }, [debounced, runSearch]);

    function onSubmit() {
        const q = text.trim();
        if (q.length < MIN_QUERY_LENGTH) return;
        lastQuery.current = q;
        runSearch(q);
    }

    const showingOutcome = lookupState.kind !== 'idle';

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.input}
                value={text}
                onChangeText={(t) => {
                    setText(t);
                    if (t.trim().length < MIN_QUERY_LENGTH) setState({ kind: 'idle' });
                }}
                onSubmitEditing={onSubmit}
                placeholder="Search products (min. 3 letters)"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="search"
                autoCorrect={false}
                autoFocus
            />

            {showingOutcome ? (
                <View style={styles.outcome}>
                    <LookupOutcomePanel state={lookupState} onRetry={lookup} onDismiss={reset} />
                </View>
            ) : (
                <>
                    {state.kind === 'loading' && <ActivityIndicator style={styles.spinner} color={colors.primary} />}
                    {state.kind === 'idle' && (
                        <Text style={styles.hint}>
                            Search Open Food Facts by name or brand. Searches run when you stop typing or press search.
                        </Text>
                    )}
                    {state.kind === 'error' && (
                        <View style={styles.centered}>
                            <Text style={styles.hint}>{catalogErrorMessage(state.error)}</Text>
                            <Pressable style={styles.linkButton} onPress={onSubmit}>
                                <Text style={styles.linkText}>Try again</Text>
                            </Pressable>
                            <Pressable style={styles.linkButton} onPress={() => router.back()}>
                                <Text style={styles.linkText}>Add manually</Text>
                            </Pressable>
                        </View>
                    )}
                    {state.kind === 'results' && (
                        <FlatList
                            data={state.items}
                            keyExtractor={(item) => item.code}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <Text style={styles.hint}>No products found. Try another spelling, or add it manually.</Text>
                            }
                            renderItem={({ item }) => <HitRow hit={item} styles={styles} onPress={() => lookup(item.code)} />}
                            ListFooterComponent={
                                state.hasMore ? (
                                    <Pressable style={styles.linkButton} onPress={() => runSearch(lastQuery.current, state.page + 1)}>
                                        {state.loadingMore ? (
                                            <ActivityIndicator color={colors.primary} />
                                        ) : (
                                            <Text style={styles.linkText}>Load more</Text>
                                        )}
                                    </Pressable>
                                ) : null
                            }
                        />
                    )}
                </>
            )}
            <OffAttribution />
        </View>
    );
}

function HitRow({ hit, styles, onPress }: { hit: CatalogHit; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
    return (
        <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
            {hit.image_url ? <Image source={{ uri: hit.image_url }} style={styles.thumb} /> : <View style={styles.thumb} />}
            <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={2}>{hit.name}</Text>
                {hit.brand ? <Text style={styles.sub} numberOfLines={1}>{hit.brand}{hit.quantity ? ` · ${hit.quantity}` : ''}</Text> : null}
            </View>
            <View style={styles.kcal}>
                <Text style={styles.kcalValue}>{hit.kcal_100g ?? '–'}</Text>
                <Text style={styles.kcalLabel}>KCAL/100G</Text>
            </View>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.pageBackground, padding: Spacing.xl, gap: Spacing.md },
        input: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            backgroundColor: colors.card,
            color: colors.text,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            fontSize: Typography.fontSize.base,
        },
        spinner: { marginTop: Spacing.xl },
        hint: { color: colors.textSecondary, fontSize: Typography.fontSize.base, textAlign: 'center', marginTop: Spacing.lg },
        centered: { alignItems: 'center', gap: Spacing.sm },
        linkButton: { paddingVertical: Spacing.md, alignItems: 'center' },
        linkText: { color: colors.primary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
        outcome: { flex: 1, justifyContent: 'center' },
        list: { gap: Spacing.sm, paddingBottom: Spacing.lg },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            padding: Spacing.md,
        },
        thumb: { width: 48, height: 48, borderRadius: Radii.md, backgroundColor: colors.surface },
        rowText: { flex: 1, gap: 2 },
        name: { color: colors.text, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
        sub: { color: colors.textSecondary, fontSize: Typography.fontSize.sm },
        kcal: { alignItems: 'flex-end' },
        kcalValue: { color: colors.text, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
        kcalLabel: { color: colors.textSecondary, fontFamily: Typography.fontFamily.mono, fontSize: Typography.fontSize.xxs },
    });
}
