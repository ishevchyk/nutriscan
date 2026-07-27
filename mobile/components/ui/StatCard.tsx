import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import {formatValue} from "../../utils/formatUtils";

type StatCardSize = 'lg' | 'sm';

type StatCardProps = {
  label: string;
  unit: string;
  value: number | null;
  onChangeValue?: (value: number | null) => void;
  size?: StatCardSize;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StatCard({ label, unit, value, onChangeValue, size = 'lg', style, testID }: StatCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const editable = onChangeValue != null;

  const [text, setText] = useState(formatValue(value));

  useEffect(() => {
    setText(formatValue(value));
  }, [value]);

  function handleChangeText(raw: string) {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    setText(cleaned);
    if (cleaned === '' || cleaned === '.') {
      onChangeValue?.(null);
      return;
    }
    const parsed = Number(cleaned);
    onChangeValue?.(Number.isNaN(parsed) ? null : parsed);
  }

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        {editable ? (
          <TextInput
            style={styles.value}
            value={text}
            onChangeText={handleChangeText}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            testID={testID}
          />
        ) : (
          <Text style={styles.value} testID={testID}>
            {text}
          </Text>
        )}
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, size: StatCardSize) {
  const isLarge = size === 'lg';
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: isLarge ? Spacing.lg : Spacing.md,
      justifyContent: 'space-between',
      minHeight: isLarge ? 96 : 84,
    },
    label: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
    },
    value: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: isLarge ? Typography.fontSize.xl : Typography.fontSize.lg,
      color: colors.text,
      padding: 0,
      flexShrink: 1,
    },
    unit: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
      marginLeft: Spacing.xs,
    },
  });
}
