import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { usePickProduct } from '../../hooks/usePickProduct';
import { Product } from '../../store/productStore';
import { MealSlot, NewProductLogEntry, useLogStore } from '../../store/logStore';
import { computeIngredientsNutrition } from '../../utils/nutritionUtils';
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
  const [grams, setGrams] = useState<number | null>(null);
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <StatCard label="Grams consumed" unit="g" value={grams} onChangeValue={setGrams} />

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
