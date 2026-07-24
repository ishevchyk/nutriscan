import { useMemo } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';

type NotesFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minHeight?: number;
};

export function NotesField({
  value,
  onChangeText,
  onBlur,
  placeholder = 'Where you buy it, serving reminders, etc.',
  minHeight = 96,
}: NotesFieldProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TextInput
      style={[styles.textarea, { minHeight }]}
      value={value}
      onChangeText={onChangeText}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      multiline
      textAlignVertical="top"
    />
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    textarea: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      fontFamily: Typography.fontFamily.sans,
      fontSize: Typography.fontSize.base,
      color: colors.text,
    },
  });
}
