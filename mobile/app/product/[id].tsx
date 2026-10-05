import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useWatch } from 'react-hook-form';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { NewPortionDraft, useNutritionBasis } from '../../hooks/useNutritionBasis';
import { ProductFormInput, ProductFormValues, useProductForm } from '../../hooks/useProductForm';
import { useSaveQueue } from '../../hooks/useSaveQueue';
import { NewProduct, useProductStore } from '../../store/productStore';
import { useGroupStore } from '../../store/groupStore';
import { showToast } from '../../store/toastStore';
import { ProductFormFields } from '../../components/products/ProductFormFields';
import { backAction, ScreenHeader } from '../../components/navigation/ScreenHeader';
import { SaveStatusLabel } from '../../components/ui';

// '' and undefined mean the same as null (unknown) when comparing form values.
const norm = (v: unknown) => (v === '' || v === undefined ? null : v);

type Payload = { patch: Partial<NewProduct>; snapshot: ProductFormInput };

export default function ProductDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { products, loaded, loadProducts, updateProduct, removeProduct, restoreProduct, assignProductToGroups, removeProductFromGroup, addPortion } = useProductStore();
    const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
    const colors = useThemeColor();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const save = useSaveQueue();

    useEffect(() => {
        if (!loaded) {
            loadProducts();
        }
    }, [loaded]);

    useEffect(() => {
        if (!groupsLoaded) {
            fetchGroups();
        }
    }, [groupsLoaded]);

    const product = products.find((p) => p.id === id);
    const productRef = useRef(product);
    productRef.current = product;
    const basis = useNutritionBasis(product?.portions ?? []);

    const { control, handleSubmit, getValues, reset, formState: { errors } } = useProductForm(product);

    // Form values as of the last successful save (or load); fields that differ
    // from it are the ones to send.
    const savedInput = useRef<ProductFormInput | null>(null);
    useEffect(() => {
        if (product) savedInput.current = getValues();
    }, [product?.id]);

    const formPayload = useRef<Payload | null>(null);
    const lastPayload = useRef<Payload | null>(null);
    const formQueued = useRef(false);
    const deleting = useRef(false);

    async function persist({ patch, snapshot }: Payload) {
        await updateProduct(id, patch);
        savedInput.current = snapshot;
        // New baseline = what was sent; anything typed while the request was in
        // flight stays dirty and is picked up by the next commit.
        reset(snapshot, { keepValues: true });
    }

    // At most one form save is queued behind the in-flight one, and it always
    // sends the latest values.
    function enqueueFormSave(payload: Payload) {
        formPayload.current = payload;
        lastPayload.current = payload;
        if (formQueued.current) return;
        formQueued.current = true;
        void save.run(async () => {
            formQueued.current = false;
            const next = formPayload.current ?? lastPayload.current; // lastPayload: Retry
            formPayload.current = null;
            if (next) await persist(next);
        });
    }

    function onValid(data: ProductFormValues) {
        const raw = getValues();
        const saved = savedInput.current ?? raw;

        const patch: Record<string, unknown> = {};
        for (const key of Object.keys(raw) as (keyof ProductFormInput)[]) {
            if (key === 'nutrients') continue;
            if (norm(raw[key]) !== norm(saved[key])) patch[key] = data[key as keyof ProductFormValues];
        }

        // A cleared value sends null (deletes it); a never-set empty one is left out.
        const rawN = (raw.nutrients ?? {}) as Record<string, unknown>;
        const savedN = (saved.nutrients ?? {}) as Record<string, unknown>;
        const nutrients: Record<string, number | null> = {};
        for (const code of new Set([...Object.keys(rawN), ...Object.keys(savedN)])) {
            if (norm(rawN[code]) === norm(savedN[code])) continue;
            const amount = data.nutrients?.[code] ?? null;
            if (amount != null || productRef.current?.nutrients[code] != null) nutrients[code] = amount;
        }
        if (Object.keys(nutrients).length > 0) patch.nutrients = nutrients;

        if (Object.keys(patch).length === 0) {
            savedInput.current = raw;
            return;
        }
        enqueueFormSave({ patch: patch as Partial<NewProduct>, snapshot: raw });
    }

    // Invalid input shows the field's inline error (via formState) and sends nothing.
    function commit() {
        if (deleting.current || !productRef.current) return;
        void handleSubmit(onValid)();
    }

    // The notes editor has no blur event, so commit shortly after typing stops.
    const notes = useWatch({ control, name: 'notes' });
    useEffect(() => {
        if (!product || norm(notes) === norm(savedInput.current?.notes)) return;
        const timer = setTimeout(commit, 1200);
        return () => clearTimeout(timer);
    }, [notes]);

    // Leaving with an uncommitted edit (e.g. back pressed while a field is
    // focused) saves it; the store call outlives the screen.
    const flushOnLeave = useRef<() => void>(() => {});
    flushOnLeave.current = () => {
        if (deleting.current || !productRef.current) return;
        const name = productRef.current.name;
        void handleSubmit(onValid)()
            .then(() => save.idle())
            .then(() => {
                if (save.hasFailed()) showToast({ message: `Couldn't save changes to "${name}"` });
            });
    };
    useEffect(() => () => flushOnLeave.current(), []);

    const selectedGroupIds = product?.groups.map((g) => g.id) ?? [];

    function toggleGroup(groupId: string) {
        if (deleting.current) return;
        void save.run(() => {
            // Read the store at run time: toggles queued back to back must see each other.
            const current = useProductStore.getState().products.find((p) => p.id === id);
            return current?.groups.some((g) => g.id === groupId)
                ? removeProductFromGroup(id, groupId)
                : assignProductToGroups(id, [groupId]);
        });
    }

    // Saves just the portion (name + grams) straight away and switches to it;
    // typed nutrition values autosave like any other field.
    async function onSavePortion(np: NewPortionDraft) {
        const created = await save.run(() => {
            const current = useProductStore.getState().products.find((p) => p.id === id);
            return addPortion(id, { ...np, is_default: (current?.portions.length ?? 0) === 0 });
        });
        if (!created) return;
        basis.setView(created.id);
        basis.setDraftName('');
        basis.setDraftGrams(null);
    }

    async function onDelete() {
        if (!product || deleting.current) return;
        deleting.current = true;
        const name = product.name;
        await save.idle();
        try {
            await removeProduct(id);
        } catch {
            deleting.current = false;
            showToast({ message: `Couldn't delete "${name}"` });
            return;
        }
        router.back();
        showToast({
            message: `Deleted "${name}"`,
            actionLabel: 'UNDO',
            onAction: () => {
                restoreProduct(id).catch(() => showToast({ message: `Couldn't restore "${name}"` }));
            },
        });
    }

    if (loaded && !product) {
        return (
            <ScrollView style={{ backgroundColor: colors.pageBackground }} contentContainerStyle={styles.container}>
                <Text style={styles.notFound}>Product not found.</Text>
            </ScrollView>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    header: () => (
                        <ScreenHeader
                            headerTitle="Product"
                            rightAction={backAction('Back')}
                            statusSlot={<SaveStatusLabel status={save.status} onRetry={save.retry} />}
                        />
                    ),
                }}
            />
            <ScrollView style={{ backgroundColor: colors.pageBackground }} contentContainerStyle={styles.container}>
                <ProductFormFields
                    control={control}
                    errors={errors}
                    groups={groups}
                    selectedGroupIds={selectedGroupIds}
                    onToggleGroup={toggleGroup}
                    product={product}
                    basis={basis}
                    onSavePortion={onSavePortion}
                    onCommit={commit}
                    onTrack={save.run}
                />

                <View style={styles.footer}>
                    <Pressable
                        style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}
                        onPress={onDelete}
                        accessibilityRole="button"
                    >
                        <Text style={styles.deleteText}>Delete product</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </>
    );
}

function createStyles(colors: ThemeColors) {
    return StyleSheet.create({
        container: {
            padding: Spacing.xl,
            backgroundColor: colors.pageBackground,
            gap: Spacing.sm,
        },
        notFound: {
            color: colors.textSecondary,
            fontSize: Typography.fontSize.base,
            textAlign: 'center',
        },
        footer: {
            marginTop: Spacing.xl,
            paddingTop: Spacing.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        deleteButton: {
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Radii.lg,
        },
        // Faint destructive tint (hex alpha) instead of a fill.
        deletePressed: { backgroundColor: `${colors.error}1A` },
        deleteText: {
            color: colors.error,
            fontSize: Typography.fontSize.base,
            fontWeight: Typography.fontWeight.semibold,
        },
    });
}
