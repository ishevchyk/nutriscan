import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BottomSheet, StatCard } from '../ui';

type MissingConversionSheetProps = {
  productName: string | null;
  unit: string | null;
  onCancel: () => void;
  onSave: (grams: number) => void;
};

export function MissingConversionSheet({ productName, unit, onCancel, onSave }: MissingConversionSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visible = productName != null && unit != null;
  const [grams, setGrams] = useState<number | null>(null);

  useEffect(() => {
    setGrams(null);
  }, [productName, unit]);

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="New unit" scrollable>
      <View style={styles.body}>
        <Text style={styles.question}>
          How much does 1 {unit} of {productName} weigh?
        </Text>
        <StatCard label="Weight" unit="g" value={grams} onChangeValue={setGrams} size="sm" />
        <Pressable
          style={[styles.saveButton, (!grams || grams <= 0) && styles.saveButtonDisabled]}
          onPress={() => grams && grams > 0 && onSave(grams)}
          disabled={!grams || grams <= 0}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { gap: Spacing.md, paddingTop: Spacing.sm },
    question: {
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primaryPressed,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
    },
  });
}
