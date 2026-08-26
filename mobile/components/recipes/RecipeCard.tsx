import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { RecipeSummary } from '../../store/recipeStore';
import { ProductCardBase } from '../products/ProductCardBase';

type RecipeCardProps = {
  item: RecipeSummary;
};

export const RecipeCard = memo(function RecipeCard({ item }: RecipeCardProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <ProductCardBase
      name={item.name}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
      footer={
        <View style={styles.footer}>
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <MaterialDesignIcons name="bowl-mix" size={20} color={colors.textSecondary} />
            </View>
          )}
          <Text style={styles.updatedLabel}>Updated {new Date(item.updated_at).toLocaleDateString()}</Text>
        </View>
      }
    />
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    thumbnail: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
    },
    thumbnailPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    updatedLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
