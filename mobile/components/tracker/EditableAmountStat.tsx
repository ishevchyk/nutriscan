import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { formatAmount, sanitizeDecimalInput } from '../../utils/formatUtils';

type EditableAmountStatProps = {
  grams: number;
  onCommit: (grams: number) => void;
};

export function EditableAmountStat({ grams, onCommit }: EditableAmountStatProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(formatAmount(grams));

  useEffect(() => {
    if (!editing) setText(formatAmount(grams));
  }, [grams, editing]);

  function commit() {
    setEditing(false);
    const parsed = Number(text);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed !== grams) {
      onCommit(parsed);
    } else {
      setText(formatAmount(grams));
    }
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(raw) => setText(sanitizeDecimalInput(raw))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
          autoFocus
          selectTextOnFocus
        />
        <Text style={styles.statLabel}>amount</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={() => setEditing(true)} hitSlop={8}>
      <Text style={styles.statValue}>{formatAmount(grams)}g</Text>
      <Text style={styles.statLabel}>amount</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    editRow: { alignItems: 'center' },
    input: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.primary,
      padding: 0,
      minWidth: 30,
      textAlign: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
    },
    statValue: {
      fontFamily: Typography.fontFamily.monoBold,
      fontSize: Typography.fontSize.sm,
      color: colors.text,
      textAlign: 'center',
    },
    statLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      textTransform: 'uppercase',
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
