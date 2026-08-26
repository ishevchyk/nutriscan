import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BottomSheet } from '../ui';

type AddIngredientSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChooseFromLibrary: () => void;
  onAddProduct: () => void;
};

export function AddIngredientSheet({ visible, onClose, onChooseFromLibrary, onAddProduct }: AddIngredientSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add ingredient">
      <View style={styles.menu}>
        <Pressable style={styles.optionRow} onPress={onChooseFromLibrary}>
          <MaterialDesignIcons name="bookshelf" size={22} color={colors.primary} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Choose from library</Text>
            <Text style={styles.optionDescription}>Pick a saved product; macros stay linked to it</Text>
          </View>
        </Pressable>

        <Pressable style={styles.optionRow} onPress={onAddProduct}>
          <MaterialDesignIcons name="plus-box-outline" size={22} color={colors.primary} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Add product</Text>
            <Text style={styles.optionDescription}>
              Enter a new product - save it to the library or to this meal only
            </Text>
          </View>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    menu: { gap: Spacing.md, paddingTop: Spacing.sm },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    optionText: { flex: 1, gap: 2 },
    optionTitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    optionDescription: {
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
    },
  });
}
