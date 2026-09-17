import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { GRAM_UNIT } from '../../constants/units';
import { GroupChip } from '../groups/GroupChip';
import { BottomSheet } from '../ui';
import { sanitizeDecimalInput } from '../../utils/formatUtils';

type QuantityInputProps = {
  amount: number;
  unit: string;
  editable: boolean;
  allowedUnits: string[];
  /** Computed grams, shown as a muted "≈150g" caption when a unit isn't grams. */
  approxGrams?: number;
  onAmountCommit?: (amount: number) => void;
  onUnitChange?: (unit: string) => void;
};

function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function QuantityInput({
  amount,
  unit,
  editable,
  allowedUnits,
  approxGrams,
  onAmountCommit,
  onUnitChange,
}: QuantityInputProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState(formatAmount(amount));
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setText(formatAmount(amount));
  }, [amount, unit]);

  function handleChangeText(raw: string) {
    setText(sanitizeDecimalInput(raw));
  }

  function handleBlur() {
    const parsed = Number(text);
    if (!Number.isNaN(parsed) && parsed > 0) {
      if (parsed !== amount) onAmountCommit?.(parsed);
    } else {
      setText(formatAmount(amount));
    }
  }

  function handleUnitSelect(newUnit: string) {
    setPickerOpen(false);
    // Let the picker sheet fully dismiss before the parent may open another
    // modal (e.g., the missing-conversion prompt) in response.
    setTimeout(() => onUnitChange?.(newUnit), 350);
  }

  const caption =
    approxGrams != null && unit !== GRAM_UNIT ? `≈${Math.round(approxGrams)}${GRAM_UNIT}` : null;

  if (!editable) {
    return (
      <View style={styles.readOnlyBlock}>
        <Text style={styles.readOnlyValue}>
          {formatAmount(amount)} {unit}
        </Text>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.editableBlock}>
      <View style={styles.pill}>
        <TextInput
          style={styles.amountInput}
          value={text}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
          placeholder="0"
          placeholderTextColor={colors.placeholder}
          selectTextOnFocus
        />
        {allowedUnits.length > 1 ? (
          <Pressable style={styles.unitButton} onPress={() => setPickerOpen(true)} hitSlop={4}>
            <Text style={styles.unitButtonText}>{unit} ▾</Text>
          </Pressable>
        ) : (
          <Text style={styles.unitStatic}>{unit}</Text>
        )}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Unit">
        <View style={styles.unitChips}>
          {allowedUnits.map((option) => (
            <GroupChip key={option} label={option} selected={option === unit} onPress={() => handleUnitSelect(option)} />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    readOnlyBlock: { alignItems: 'flex-end' },
    readOnlyValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
    },
    editableBlock: { alignItems: 'flex-end', gap: 2 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    amountInput: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
      padding: 0,
      minWidth: 28,
      textAlign: 'right',
    },
    unitButton: {
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      paddingLeft: Spacing.xs,
    },
    unitButtonText: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.primary,
    },
    unitStatic: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
    },
    caption: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textTertiary,
    },
    unitChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
    },
  });
}
