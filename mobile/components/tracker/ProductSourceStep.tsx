import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePickProduct } from '../../hooks/usePickProduct';
import { Product } from '../../store/productStore';
import { MealSlot, NewProductLogEntry, useLogStore } from '../../store/logStore';
import { computeIngredientsNutrition } from '../../utils/nutritionUtils';
import { formatAmount } from '../../utils/formatUtils';
import { StatCard } from '../ui';

type ProductSourceStepProps = {
  mealSlot: MealSlot;
  onLogged: () => void;
  onCancel: () => void;
};

export function ProductSourceStep({ mealSlot, onLogged, onCancel }: ProductSourceStepProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pick } = usePickProduct();
  const { addEntry } = useLogStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [typedGrams, setTypedGrams] = useState<number | null>(null);
  // Portion mode: grams = count × portion.grams. The API still receives plain
  // quantity_grams, so server-side macro math is unchanged.
  const [portionId, setPortionId] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(1);
  const [saving, setSaving] = useState(false);
  const startedPick = useRef(false);

  useEffect(() => {
    if (startedPick.current) return;
    startedPick.current = true;
    (async () => {
      const picked = await pick();
      if (!picked) {
        onCancel();
        return;
      }
      setProduct(picked);
      setPortionId(picked.portions.find((p) => p.is_default)?.id ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const portion = product?.portions.find((p) => p.id === portionId) ?? null;
  const grams = portion ? (count ? count * portion.grams : null) : typedGrams;

  const preview = useMemo(() => {
    if (!product || !grams) return null;
    return computeIngredientsNutrition([{ grams, ...product }]).per_meal;
  }, [product, grams]);

  async function handleConfirm() {
    if (!product || !grams || grams <= 0) return;
    setSaving(true);
    try {
      const payload: NewProductLogEntry = {
        source_type: 'product',
        product_id: product.id,
        quantity_grams: grams,
        meal_slot: mealSlot,
        logged_at: new Date().toISOString(),
      };
      await addEntry(payload);
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  if (!product) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{product.name}</Text>
      {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}

      {product.portions.length > 0 && (
        <View style={styles.chips}>
          <Pressable style={[styles.chip, !portion && styles.chipOn]} onPress={() => setPortionId(null)}>
            <Text style={[styles.chipText, !portion && styles.chipTextOn]}>GRAMS</Text>
          </Pressable>
          {product.portions.map((p) => (
            <Pressable key={p.id} style={[styles.chip, portion?.id === p.id && styles.chipOn]} onPress={() => setPortionId(p.id)}>
              <Text style={[styles.chipText, portion?.id === p.id && styles.chipTextOn]}>{p.name.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {portion ? (
        <StatCard label={`Count (${formatAmount(portion.grams)} g each)`} unit="×" value={count} onChangeValue={setCount} />
      ) : (
        <StatCard label="Grams consumed" unit="g" value={typedGrams} onChangeValue={setTypedGrams} />
      )}

      {preview && (
        <View style={styles.previewRow}>
          <View style={styles.previewStat}>
            <Text style={styles.previewValue}>{Math.round(preview.calories)}</Text>
            <Text style={styles.previewLabel}>kcal</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewValue}>{Math.round(preview.protein)}g</Text>
            <Text style={styles.previewLabel}>protein</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewValue}>{Math.round(preview.fat)}g</Text>
            <Text style={styles.previewLabel}>fat</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewValue}>{Math.round(preview.carbs)}g</Text>
            <Text style={styles.previewLabel}>carbs</Text>
          </View>
        </View>
      )}

      <Pressable
        style={[styles.confirmButton, (!grams || grams <= 0 || saving) && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        disabled={!grams || grams <= 0 || saving}
      >
        <Text style={styles.confirmButtonText}>{saving ? 'Logging…' : 'Log entry'}</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    spinner: { marginTop: 40 },
    heading: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    brand: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
      marginTop: -Spacing.sm,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: {
      borderRadius: Radii.full,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primaryPressed },
    chipText: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      color: colors.textSecondary,
    },
    chipTextOn: { color: colors.onPrimary },
    previewRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
    },
    previewStat: { flex: 1, alignItems: 'center', gap: Spacing.xs },
    previewValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.lg,
      color: colors.text,
    },
    previewLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    confirmButtonDisabled: { opacity: 0.5 },
    confirmButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
