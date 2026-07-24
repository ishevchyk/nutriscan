import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { SectionLabel } from './SectionLabel';

type UnderlineFieldProps = {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  editable?: boolean;
  valueFontFamily?: 'sans' | 'mono';
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  error?: string;
  testID?: string;
};

export function UnderlineField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  editable = onChangeText != null,
  valueFontFamily = 'sans',
  keyboardType,
  autoCapitalize,
  error,
  testID,
}: UnderlineFieldProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fontFamily = valueFontFamily === 'mono' ? Typography.fontFamily.mono : Typography.fontFamily.sans;

  return (
    <View style={styles.container}>
      <SectionLabel>{label}</SectionLabel>
      {editable ? (
        <TextInput
          style={[styles.value, { fontFamily }]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          testID={testID}
        />
      ) : (
        <Text
          style={[styles.value, styles.readOnlyValue, { fontFamily }]}
          testID={testID}
        >
          {value}
        </Text>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.lg,
    },
    value: {
      fontSize: Typography.fontSize.lg,
      color: colors.text,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    readOnlyValue: {
      color: colors.placeholder,
    },
    error: {
      color: colors.error,
      fontSize: Typography.fontSize.sm,
      marginTop: Spacing.xs,
    },
  });
}
