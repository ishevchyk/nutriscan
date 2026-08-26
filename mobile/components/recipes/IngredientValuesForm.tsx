import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { GRAM_UNIT } from '../../constants/units';
import { StatCard, StatGrid, UnderlineField } from '../ui';
import { QuantityInput } from './QuantityInput';

export type IngredientFormValues = {
  name: string;
  brand: string | null;
  input_amount: number;
  input_unit: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
};

type IngredientValuesFormProps = {
  initial?: Partial<IngredientFormValues>;
  submitLabel?: string;
  allowedUnits: string[];
  onSubmit: (values: IngredientFormValues) => void | Promise<unknown>;
};

export function IngredientValuesForm({ initial, submitLabel = 'Save Values', allowedUnits, onSubmit }: IngredientValuesFormProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [amount, setAmount] = useState<number>(initial?.input_amount ?? 100);
  const [unit, setUnit] = useState<string>(initial?.input_unit ?? GRAM_UNIT);
  const [calories, setCalories] = useState<number | null>(initial?.calories ?? null);
  const [protein, setProtein] = useState<number | null>(initial?.protein ?? null);
  const [fat, setFat] = useState<number | null>(initial?.fat ?? null);
  const [carbs, setCarbs] = useState<number | null>(initial?.carbs ?? null);
  const [fiber, setFiber] = useState<number | null>(initial?.fiber ?? null);
  const [sugar, setSugar] = useState<number | null>(initial?.sugar ?? null);
  const [salt, setSalt] = useState<number | null>(initial?.salt ?? null);

  const valid = name.trim().length > 0 && amount > 0;

  async function handleSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        brand: brand.trim() || null,
        input_amount: amount,
        input_unit: unit,
        calories,
        protein,
        fat,
        carbs,
        fiber,
        sugar,
        salt,
      });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <UnderlineField label="Name" value={name} onChangeText={setName} />
      <UnderlineField label="Brand" value={brand} onChangeText={setBrand} />

      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <QuantityInput
          amount={amount}
          unit={unit}
          editable
          allowedUnits={allowedUnits}
          onAmountCommit={setAmount}
          onUnitChange={setUnit}
        />
      </View>

      <StatGrid columns={2}>
        <StatCard label="Calories" unit="kcal" value={calories} onChangeValue={setCalories} size="sm" />
        <StatCard label="Protein" unit="g" value={protein} onChangeValue={setProtein} size="sm" />
      </StatGrid>
      <StatGrid columns={2}>
        <StatCard label="Fat" unit="g" value={fat} onChangeValue={setFat} size="sm" />
        <StatCard label="Carbs" unit="g" value={carbs} onChangeValue={setCarbs} size="sm" />
      </StatGrid>
      <StatGrid columns={3}>
        <StatCard label="Fiber" unit="g" value={fiber} onChangeValue={setFiber} size="sm" />
        <StatCard label="Sugar" unit="g" value={sugar} onChangeValue={setSugar} size="sm" />
        <StatCard label="Salt" unit="g" value={salt} onChangeValue={setSalt} size="sm" />
      </StatGrid>

      <Pressable
        style={[styles.submitButton, (!valid || submitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!valid || submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    quantityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    quantityLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    submitButtonDisabled: { opacity: 0.5 },
    submitButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
