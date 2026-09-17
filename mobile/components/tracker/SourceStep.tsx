import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { SourceType } from '../../store/logStore';

type SourceStepProps = {
  onSelect: (source: SourceType) => void;
};

const SOURCES: { key: SourceType; label: string; description: string }[] = [
  { key: 'product', label: 'Product', description: 'Pick from your library, enter grams consumed' },
  { key: 'meal', label: 'Meal', description: 'Log a saved meal, by portion or grams' },
  { key: 'manual', label: 'Manual', description: 'Type in calories and macros directly' },
];

export function SourceStep({ onSelect }: SourceStepProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>How do you want to log this?</Text>
      {SOURCES.map((source) => (
        <Pressable key={source.key} style={styles.card} onPress={() => onSelect(source.key)}>
          <Text style={styles.cardLabel}>{source.label}</Text>
          <Text style={styles.cardDescription}>{source.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: Spacing.md },
    heading: {
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      backgroundColor: colors.card,
      gap: 4,
    },
    cardLabel: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    cardDescription: {
      fontSize: Typography.fontSize.sm,
      color: colors.textSecondary,
    },
  });
}
