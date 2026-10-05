import { ReactNode, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Control, Controller, useWatch } from 'react-hook-form';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ProductFormInput, ProductFormValues } from '../../hooks/useProductForm';
import { BASIS_NEW_PORTION, BASIS_PER_100G, NewPortionDraft, NutritionBasis, toDisplay, toStored } from '../../hooks/useNutritionBasis';
import { sanitizeDecimalInput } from '../../utils/formatUtils';
import { ProductPortion } from '../../store/productStore';
import { Nutrient } from '../../store/nutrientStore';
import { SectionLabel, StatCard, StatGrid } from '../ui';
import { NutritionAmountInput } from './NutritionAmountInput';
import {
    BREAKDOWN_ROWS,
    BreakdownRow,
    KJ_PER_KCAL,
    formatFact,
    microGroups,
    percentOf,
} from '../../utils/nutrientFacts';

type FormControl = Control<ProductFormInput, any, ProductFormValues>;

type Props = {
    control: FormControl;
    portions: ProductPortion[];
    nutrients: Nutrient[];
    basis: NutritionBasis;
    /** Saves the typed portion right away (edit screen). Absent on a new product, where portions can only be created after the product itself. */
    onSavePortion?: (portion: NewPortionDraft) => Promise<void>;
    /** Called on input blur so the edit screen can autosave. */
    onCommit?: () => void;
};

const CARD_FIELDS = [
    { name: 'calories', label: 'Calories', unit: 'kcal' },
    { name: 'protein', label: 'Protein', unit: 'g' },
    { name: 'fat', label: 'Fat', unit: 'g' },
    { name: 'carbs', label: 'Carbs', unit: 'g' },
] as const;

// Rows editable inline in the breakdown. calories/protein/fat/carbs are
// edited in the cards above instead, so they stay read-only here.
const INLINE_COLUMNS = new Set(['saturated_fat', 'fiber', 'sugar', 'salt']);

function toNumber(v: unknown): number | null {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
}

/**
 * Nutrition block of the product form (design: "Product Page"): a per-100g /
 * per-portion switch, macro cards, the EU-label breakdown with %RI and the
 * vitamins & minerals list with %NRV. Everything is editable inline in any
 * view: the form stores per 100g, so in a portion view values are scaled for
 * display and converted back on input (a pack's "per 1 ice cream" numbers can
 * be typed as printed). Empty optional rows are hidden until "Show all fields".
 */
export function ProductNutritionSections({ control, portions, nutrients, basis, onSavePortion, onCommit }: Props) {
    const [savingPortion, setSavingPortion] = useState(false);
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [showAll, setShowAll] = useState(false);
    // Rows that have held a value this session stay visible, so clearing an
    // input while typing doesn't make its row vanish under the cursor.
    const seen = useRef(new Set<string>());

    const watched = useWatch({ control }) as Partial<ProductFormInput>;
    const extended = (watched.nutrients ?? {}) as Record<string, number | null>;

    const { view, setView } = basis;
    const portion = portions.find((p) => p.id === view);
    const isNew = view === BASIS_NEW_PORTION;
    // null = a new portion with no weight yet: nothing can be shown or typed.
    const factor = basis.factor;
    const editable = factor != null;
    const f = factor ?? 1;
    const show = (stored: number | null) => (factor == null ? null : toDisplay(stored, factor));
    const store = (typed: number | null) => toStored(typed, f);

    const valueOf = (r: BreakdownRow): number | null => {
        if (r.column) return toNumber(watched[r.column]);
        if (r.code) return toNumber(extended[r.code]);
        return null;
    };

    const isVisible = (key: string, required: boolean, value: number | null) => {
        if (value != null) seen.current.add(key);
        return required || showAll || seen.current.has(key);
    };

    const visibleRows = BREAKDOWN_ROWS.filter((r) => isVisible(r.key, r.required, valueOf(r)));
    const groups = microGroups(nutrients)
        .map((g) => ({
            ...g,
            items: g.items.filter((n) => isVisible(n.code, false, toNumber(extended[n.code]))),
        }))
        .filter((g) => g.items.length > 0);

    return (
        <>
            <View style={styles.headerRow}>
                <SectionLabel style={styles.headerLabel}>Nutrition</SectionLabel>
                <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
                    <Text style={styles.action}>{showAll ? 'HIDE EMPTY' : 'SHOW ALL FIELDS'}</Text>
                </Pressable>
            </View>

            <View style={styles.chips}>
                <Chip label="PER 100G" selected={view === BASIS_PER_100G} onPress={() => setView(BASIS_PER_100G)} styles={styles} />
                {portions.map((p) => (
                    <Chip
                        key={p.id}
                        label={p.name.toUpperCase()}
                        selected={view === p.id}
                        onPress={() => setView(p.id)}
                        styles={styles}
                    />
                ))}
                <Chip label="+ PORTION" selected={isNew} onPress={() => setView(BASIS_NEW_PORTION)} styles={styles} />
            </View>

            {isNew && (
                <View style={styles.draft}>
                    <Text style={styles.draftHint}>
                        Type the values exactly as printed per portion; they're saved per 100 g.
                        {onSavePortion ? ' Tap SAVE PORTION to keep the portion.' : ' The portion is created when you save the product.'}
                    </Text>
                    <View style={styles.draftRow}>
                        <TextInput
                            style={[styles.draftInput, styles.flex]}
                            value={basis.draftName}
                            onChangeText={basis.setDraftName}
                            placeholder={basis.draftGrams ? `${basis.newPortion?.name ?? 'e.g. 1 ice cream'}` : "e.g. 1 ice cream"}
                            placeholderTextColor={colors.placeholder}
                        />
                        <View style={[styles.draftInput, styles.draftGrams]}>
                            <TextInput
                                style={styles.draftGramsInput}
                                value={basis.draftGrams == null ? '' : String(basis.draftGrams)}
                                onChangeText={(t) => {
                                    const cleaned = sanitizeDecimalInput(t);
                                    const n = Number(cleaned);
                                    basis.setDraftGrams(cleaned === '' || cleaned === '.' || Number.isNaN(n) ? null : n);
                                }}
                                placeholder="0"
                                placeholderTextColor={colors.placeholder}
                                keyboardType="decimal-pad"
                            />
                            <Text style={styles.draftUnit}>g</Text>
                        </View>
                    </View>
                    {onSavePortion && (
                        <Pressable
                            style={[styles.draftSave, (!basis.newPortion || savingPortion) && styles.draftSaveDisabled]}
                            disabled={!basis.newPortion || savingPortion}
                            onPress={async () => {
                                if (!basis.newPortion) return;
                                setSavingPortion(true);
                                try {
                                    await onSavePortion(basis.newPortion);
                                } finally {
                                    setSavingPortion(false);
                                }
                            }}
                        >
                            <Text style={styles.draftSaveText}>{savingPortion ? 'SAVING…' : 'SAVE PORTION'}</Text>
                        </Pressable>
                    )}
                </View>
            )}

            <StatGrid columns={2}>
                {CARD_FIELDS.map((f) => (
                    <Controller
                        key={f.name}
                        control={control}
                        name={f.name}
                        render={({ field: { onChange, value } }) => {
                            const n = show(toNumber(value));
                            return (
                                <StatCard
                                    label={f.label}
                                    unit={f.unit}
                                    value={n}
                                    onChangeValue={editable ? (t) => onChange(store(t)) : undefined}
                                    onBlur={onCommit}
                                    size="lg"
                                />
                            );
                        }}
                    />
                ))}
            </StatGrid>

            <View style={styles.sectionHeader}>
                <SectionLabel style={styles.headerLabel}>Full breakdown</SectionLabel>
                <Text style={styles.basis}>
                    {view === BASIS_PER_100G
                        ? 'PER 100 G'
                        : basis.grams == null
                          ? 'ENTER PORTION WEIGHT'
                          : `PER ${(portion?.name ?? basis.newPortion?.name ?? 'PORTION').toUpperCase()} · ${formatFact(basis.grams)} G`}
                </Text>
            </View>
            <View style={styles.card}>
                <View style={styles.tableHead}>
                    <Text style={[styles.headText, styles.flex]}>NUTRIENT</Text>
                    <Text style={styles.headText}>AMOUNT</Text>
                    <Text style={[styles.headText, styles.pctCol]}>%RI</Text>
                </View>
                {visibleRows.map((r) => {
                    const raw = valueOf(r);
                    const scaled = factor == null || raw == null ? null : raw * factor;
                    const inline = editable && ((r.column && INLINE_COLUMNS.has(r.column)) || r.code);
                    return (
                        <View key={r.key} style={[styles.row, { paddingLeft: r.child ? Spacing.lg : 0 }]}>
                            <Text style={[r.child ? styles.childLabel : styles.rowLabel, styles.flex]}>{r.label}</Text>
                            {inline ? (
                                <InlineInput control={control} row={r} show={show} store={store} onCommit={onCommit} />
                            ) : (
                                <Text style={[styles.amount, scaled == null && styles.unknown]}>
                                    {scaled == null
                                        ? '—'
                                        : r.unit === 'kcal'
                                          ? `${Math.round(scaled)} kcal · ${Math.round(scaled * KJ_PER_KCAL)} kJ`
                                          : `${formatFact(scaled)} ${r.unit}`}
                                </Text>
                            )}
                            <Text style={[styles.pct, styles.pctCol]}>
                                {scaled != null && r.referenceIntake ? percentOf(scaled, r.referenceIntake) : ''}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.sectionHeader}>
                <SectionLabel style={styles.headerLabel}>Vitamins & minerals</SectionLabel>
                <Text style={styles.basis}>%NRV</Text>
            </View>
            {groups.length > 0 ? (
                <View style={styles.card}>
                    {groups.map((g) => (
                        <View key={g.label}>
                            <Text style={styles.groupLabel}>{g.label.toUpperCase()}</Text>
                            {g.items.map((n) => {
                                const raw = toNumber(extended[n.code]);
                                const scaled = factor == null || raw == null ? null : raw * factor;
                                const pct = scaled != null && n.nrv ? (scaled / n.nrv) * 100 : null;
                                return (
                                    <View key={n.code} style={styles.microRow}>
                                        <View style={styles.microTop}>
                                            <Text style={[styles.rowLabel, styles.flex]}>{n.name}</Text>
                                            {editable ? (
                                                <Controller
                                                    control={control}
                                                    name={`nutrients.${n.code}` as any}
                                                    render={({ field: { onChange, onBlur, value } }) => (
                                                        <NutritionAmountInput
                                                            value={show(toNumber(value))}
                                                            onChangeValue={(t) => onChange(store(t))}
                                                            onBlur={() => {
                                                                onBlur();
                                                                onCommit?.();
                                                            }}
                                                            unit={n.unit}
                                                        />
                                                    )}
                                                />
                                            ) : (
                                                <Text style={[styles.amount, scaled == null && styles.unknown]}>
                                                    {scaled == null ? '—' : `${formatFact(scaled)} ${n.unit}`}
                                                </Text>
                                            )}
                                            <Text style={[styles.pct, styles.pctCol]}>
                                                {pct != null ? `${Math.round(pct)}%` : ''}
                                            </Text>
                                        </View>
                                        <View style={styles.bar}>
                                            <View style={[styles.barFill, { width: `${Math.min(100, pct ?? 0)}%` }]} />
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>None recorded</Text>
                    <Pressable onPress={() => setShowAll(true)} hitSlop={8}>
                        <Text style={styles.action}>+ ADD VALUES</Text>
                    </Pressable>
                </View>
            )}
        </>
    );
}

function InlineInput({
    control,
    row,
    show,
    store,
    onCommit,
}: {
    control: FormControl;
    row: BreakdownRow;
    show: (stored: number | null) => number | null;
    store: (typed: number | null) => number | null;
    onCommit?: () => void;
}): ReactNode {
    const name = (row.column ?? `nutrients.${row.code}`) as any;
    return (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value } }) => (
                <NutritionAmountInput
                    value={show(toNumber(value))}
                    onChangeValue={(t) => onChange(store(t))}
                    onBlur={() => {
                        onBlur();
                        onCommit?.();
                    }}
                    unit={row.unit}
                />
            )}
        />
    );
}

function Chip({
    label,
    selected,
    onPress,
    styles,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </Pressable>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        flex: { flex: 1 },
        headerRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: Spacing.lg,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: Spacing.xl,
            marginBottom: Spacing.sm,
        },
        headerLabel: { marginBottom: 0 },
        action: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.xs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.primary,
        },
        basis: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textSecondary,
        },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginVertical: Spacing.md },
        chip: {
            borderRadius: Radii.full,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        chipSelected: { backgroundColor: colors.primary, borderColor: colors.primaryPressed },
        chipText: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.xs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textSecondary,
        },
        chipTextSelected: { color: colors.onPrimary },
        draft: { gap: Spacing.sm, marginBottom: Spacing.md },
        draftHint: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
        draftRow: { flexDirection: 'row', gap: Spacing.sm },
        draftInput: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.lg,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            fontSize: Typography.fontSize.base,
            color: colors.text,
        },
        draftSave: {
            alignSelf: 'flex-start',
            backgroundColor: colors.primary,
            borderRadius: Radii.lg,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.lg,
        },
        draftSaveDisabled: { opacity: 0.4 },
        draftSaveText: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.xs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.onPrimary,
        },
        draftGrams: { width: 88, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        draftGramsInput: { flex: 1, padding: 0, fontFamily: Typography.fontFamily.monoMedium, color: colors.text },
        draftUnit: { fontFamily: Typography.fontFamily.mono, fontSize: Typography.fontSize.sm, color: colors.textSecondary },
        card: {
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: Radii.xl,
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.xs,
        },
        tableHead: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm },
        headText: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xxs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textTertiary,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: Spacing.sm,
            paddingVertical: Spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        rowLabel: { fontSize: Typography.fontSize.base, color: colors.text },
        childLabel: { fontSize: Typography.fontSize.sm, color: colors.textSecondary },
        amount: {
            fontFamily: Typography.fontFamily.monoMedium,
            fontSize: Typography.fontSize.sm,
            color: colors.text,
        },
        unknown: { color: colors.textTertiary },
        pct: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xs,
            color: colors.textTertiary,
            textAlign: 'right',
        },
        pctCol: { width: 44, textAlign: 'right' },
        groupLabel: {
            fontFamily: Typography.fontFamily.mono,
            fontSize: Typography.fontSize.xxs,
            letterSpacing: Typography.letterSpacing.label,
            color: colors.textTertiary,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xs,
        },
        microRow: { gap: 6, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
        microTop: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
        bar: { height: 4, borderRadius: 2, backgroundColor: colors.surface, overflow: 'hidden' },
        barFill: { height: '100%', backgroundColor: colors.primary },
        empty: {
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: Radii.xl,
            padding: Spacing.lg,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        emptyText: { fontSize: Typography.fontSize.base, color: colors.textSecondary },
    });
}
