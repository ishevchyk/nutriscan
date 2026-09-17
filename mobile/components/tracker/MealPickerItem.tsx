import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { MealSummary } from '../../store/mealStore';

type MealPickerItemProps = {
  item: MealSummary;
  onSelect: (meal: MealSummary) => void;
};

export const MealPickerItem = memo(function MealPickerItem({ item, onSelect }: MealPickerItemProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable style={styles.card} onPress={() => onSelect(item)}>
      <Text style={styles.name}>{item.name}</Text>
    </Pressable>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    name: {
      fontSize: Typography.fontSize.sm,
      fontWeight: Typography.fontWeight.medium,
      color: colors.text,
    },
  });
}
