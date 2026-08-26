import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BottomSheet } from '../ui';
import { LinkBadge } from './LinkBadge';
import { IngredientFormValues, IngredientValuesForm } from './IngredientValuesForm';
import { IngredientVM } from './types';

type IngredientManageSheetProps = {
  ingredient: IngredientVM | null;
  onClose: () => void;
  onOpenInLibrary: (productId: string) => void;
  onSwap: () => void;
  editValuesAllowedUnits: string[];
  onEditValues: (values: IngredientFormValues) => void | Promise<unknown>;
  onUnlink: () => void;
  onAddToLibrary: () => void;
  onRemove: () => void;
};

type SheetPage = 'menu' | 'edit';

export function IngredientManageSheet({
  ingredient,
  onClose,
  onOpenInLibrary,
  onSwap,
  editValuesAllowedUnits,
  onEditValues,
  onUnlink,
  onAddToLibrary,
  onRemove,
}: IngredientManageSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [page, setPage] = useState<SheetPage>('menu');

  useEffect(() => {
    setPage('menu');
  }, [ingredient?.key]);

  if (!ingredient) {
    return null;
  }

  function confirmRemove() {
    Alert.alert(`Remove "${ingredient!.name}"?`, 'This ingredient will be removed from the meal.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  }

  const title = (
    <View style={styles.titleRow}>
      <Text style={styles.titleText} numberOfLines={1}>
        {ingredient.name}
      </Text>
      <LinkBadge linked={ingredient.is_linked} />
    </View>
  );

  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={title}
      subtitle={
        ingredient.is_linked && ingredient.product_id
          ? `Linked to ${ingredient.product_id.slice(0, 8)}`
          : undefined
      }
      scrollable
    >
      {page === 'menu' ? (
        <View style={styles.menu}>
          {ingredient.is_linked && ingredient.product_id ? (
            <ActionRow
              styles={styles}
              highlighted
              title="Open in Product Library →"
              description="Edit the saved product itself — name, barcode, macros and groups"
              onPress={() => onOpenInLibrary(ingredient.product_id!)}
            />
          ) : null}

          {ingredient.is_linked ? (
            <ActionRow
              styles={styles}
              title="Swap linked product"
              description="Pick a different product; macros update and nutrition recalculates"
              onPress={onSwap}
            />
          ) : null}

          <ActionRow
            styles={styles}
            title="Edit values directly"
            description={
              // editValuesAllowedUnits only offers household units when this
              // screen keeps the product link on a values edit (see the two
              // call sites) -- in the builder it's always grams-only because
              // editing values there converts the ingredient to unlinked.
              editValuesAllowedUnits.length > 1
                ? 'Manual override of name, brand and macros — the product link stays intact'
                : 'Edit the name, brand and macros of this ingredient'
            }
            onPress={() => setPage('edit')}
          />

          {ingredient.is_linked ? (
            <ActionRow
              styles={styles}
              title="Unlink from product"
              description="Keeps the current macro snapshot on the ingredient"
              onPress={onUnlink}
            />
          ) : (
            <ActionRow
              styles={styles}
              title="Add to Product Library"
              description="Save this ingredient as a reusable product and link it"
              onPress={onAddToLibrary}
            />
          )}

          <Pressable style={styles.removeRow} onPress={confirmRemove}>
            <Text style={styles.removeText}>Remove from meal</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.menu}>
          <Pressable onPress={() => setPage('menu')} hitSlop={8}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <IngredientValuesForm
            key={ingredient.key}
            initial={ingredient}
            allowedUnits={editValuesAllowedUnits}
            submitLabel="Save Values"
            onSubmit={onEditValues}
          />
        </View>
      )}
    </BottomSheet>
  );
}

function ActionRow({
  styles,
  title,
  description,
  onPress,
  highlighted = false,
}: {
  styles: ReturnType<typeof createStyles>;
  title: string;
  description: string;
  onPress: () => void;
  highlighted?: boolean;
}) {
  return (
    <Pressable style={[styles.actionRow, highlighted && styles.actionRowHighlighted]} onPress={onPress}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    titleText: {
      flexShrink: 1,
      fontSize: Typography.fontSize.lg,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    menu: { gap: Spacing.md, paddingTop: Spacing.sm },
    actionRow: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      gap: 2,
    },
    actionRowHighlighted: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    actionTitle: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.text,
    },
    actionDescription: {
      fontSize: Typography.fontSize.xs,
      color: colors.textSecondary,
    },
    removeRow: {
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    removeText: {
      fontSize: Typography.fontSize.base,
      fontWeight: Typography.fontWeight.semibold,
      color: colors.error,
    },
    backLink: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
  });
}
