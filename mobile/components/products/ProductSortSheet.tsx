import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ProductFilterState } from '../../store/productFilterStore';
import { DEFAULT_SORT, SORT_OPTIONS } from '../../utils/productFilters';
import { ProductSheetShell } from './ProductSheetShell';

type ProductSortSheetProps = {
  visible: boolean;
  filterState: ProductFilterState;
  onClose: () => void;
  resultCount: number;
};

export function ProductSortSheet({ visible, filterState, onClose, resultCount }: ProductSortSheetProps) {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { sort, setSort, resetSort } = filterState;

  return (
    <ProductSheetShell
      visible={visible}
      onClose={onClose}
      title="Sort"
      onReset={resetSort}
      resetDisabled={sort === DEFAULT_SORT}
      resultCount={resultCount}
    >
      <Text style={styles.sectionLabel}>Sort by</Text>
      <View style={styles.listCard}>
        {SORT_OPTIONS.map((option, index) => {
          const selected = option.key === sort;
          return (
            <Pressable
              key={option.key}
              style={[styles.row, index > 0 && styles.rowDivider]}
              onPress={() => setSort(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={styles.rowLabel}>{option.label}</Text>
              {selected && <MaterialDesignIcons name="check" size={18} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </ProductSheetShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
      color: colors.textSecondary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    listCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.lg,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md + 2,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    rowLabel: { fontSize: Typography.fontSize.base, color: colors.text },
  });
}
