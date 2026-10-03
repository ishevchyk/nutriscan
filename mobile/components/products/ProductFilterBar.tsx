import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Product } from '../../store/productStore';
import { Group } from '../../store/types';
import { ProductFilterState } from '../../store/productFilterStore';
import { afterSheetClose } from '../../utils/afterSheetClose';
import { ProductFilters, SORT_OPTIONS } from '../../utils/productFilters';
import { ProductFiltersSheet } from './ProductFiltersSheet';
import { ProductSortSheet } from './ProductSortSheet';

type OpenSheet = 'filters' | 'sort' | null;

type ProductFilterBarProps = {
  filterState: ProductFilterState;
  /** Filters after `effectiveFilters` (stale group ids dropped). */
  activeFilters: ProductFilters;
  activeFilterCount: number;
  favoriteCount: number;
  /** The whole library -- the Filters sheet derives brand/kcal options from it. */
  products: Product[];
  groups: Group[];
  resultCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  autoFocus?: boolean;
};

/**
 * Search, Filters/favourites/Sort controls, result count and their sheets.
 * Stateless about filtering itself -- the caller owns `filterState`, so the
 * Products tab and the picker can each bring their own.
 */
export function ProductFilterBar({
  filterState,
  activeFilters,
  activeFilterCount,
  favoriteCount,
  products,
  groups,
  resultCount,
  query,
  onQueryChange,
  searchPlaceholder,
  autoFocus,
}: ProductFilterBarProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const sortLabel = SORT_OPTIONS.find((o) => o.key === filterState.sort)?.short ?? '';

  function handleManageGroups() {
    setOpenSheet(null);
    // Groups are managed from the Profile tab. From the picker this dismisses it, which cancels the pick.
    afterSheetClose(() => router.navigate('/(tabs)/profile'));
  }

  return (
    <>
      <TextInput
        placeholder={searchPlaceholder}
        placeholderTextColor={colors.placeholder}
        style={styles.searchInput}
        value={query}
        onChangeText={onQueryChange}
        clearButtonMode="while-editing"
        autoFocus={autoFocus}
      />

      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.pill, activeFilterCount > 0 && styles.pillActive]}
          onPress={() => setOpenSheet('filters')}
          accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : 'Filters'}
        >
          <Text style={[styles.pillText, activeFilterCount > 0 && styles.pillTextActive]}>
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.pill, styles.favPill, activeFilters.favoritesOnly && styles.pillActive]}
          onPress={filterState.toggleFavoritesOnly}
          accessibilityRole="switch"
          accessibilityState={{ checked: activeFilters.favoritesOnly }}
          accessibilityLabel={`Favourites only, ${favoriteCount} favourites`}
        >
          <MaterialDesignIcons
            name={activeFilters.favoritesOnly ? 'heart' : 'heart-outline'}
            size={14}
            color={activeFilters.favoritesOnly ? colors.onPrimary : colors.textSecondary}
          />
          <Text style={[styles.pillText, activeFilters.favoritesOnly && styles.pillTextActive]}>{favoriteCount}</Text>
        </Pressable>

        <Pressable style={styles.sortButton} onPress={() => setOpenSheet('sort')} hitSlop={8}>
          <Text style={styles.metaLabel}>Sort: </Text>
          <Text style={styles.sortValue} numberOfLines={1}>
            {sortLabel}
          </Text>
          <MaterialDesignIcons name="menu-down" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.metaLabel}>
        {resultCount} product{resultCount === 1 ? '' : 's'}
      </Text>

      <ProductFiltersSheet
        visible={openSheet === 'filters'}
        filterState={filterState}
        onClose={() => setOpenSheet(null)}
        products={products}
        groups={groups}
        resultCount={resultCount}
        onManageGroups={handleManageGroups}
      />
      <ProductSortSheet
        visible={openSheet === 'sort'}
        filterState={filterState}
        onClose={() => setOpenSheet(null)}
        resultCount={resultCount}
      />
    </>
  );
}

function createStyles(colors: ThemeColors) {
  const monoLabel = {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.xxs,
    textTransform: 'uppercase' as const,
    letterSpacing: Typography.letterSpacing.label,
  };
  return StyleSheet.create({
    metaLabel: { ...monoLabel, color: colors.textSecondary },
    searchInput: {
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    controlsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: Radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    favPill: { paddingHorizontal: Spacing.md - 2 },
    pillActive: { backgroundColor: colors.primary, borderColor: colors.primaryPressed },
    pillText: {
      fontFamily: Typography.fontFamily.monoMedium,
      fontSize: Typography.fontSize.xxs,
      letterSpacing: Typography.letterSpacing.label,
      textTransform: 'uppercase',
      color: colors.text,
    },
    pillTextActive: { color: colors.onPrimary, fontFamily: Typography.fontFamily.monoBold },
    sortButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    sortValue: { ...monoLabel, color: colors.primary, flexShrink: 1 },
  });
}
