import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Radii, Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';
import { useGroupStore } from '../../store/groupStore';
import { useProductFilterStore } from '../../store/productFilterStore';
import { ProductCard } from '../../components/products/ProductCard';
import { ProductFiltersSheet } from '../../components/products/ProductFiltersSheet';
import { ProductSortSheet } from '../../components/products/ProductSortSheet';
import { afterSheetClose } from '../../utils/afterSheetClose';
import {
  applyProductFilters,
  countActiveFilters,
  effectiveFilters,
  SORT_OPTIONS,
  sortProducts,
} from '../../utils/productFilters';

type OpenSheet = 'filters' | 'sort' | null;

export default function ProductsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { products, loaded, statsStale, loadProducts } = useProductStore();
  const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
  const { filters, sort, toggleFavoritesOnly, resetFilters } = useProductFilterStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  // Load once (same guard as tracker/profile) -- not on every mount.
  useEffect(() => {
    if (!userId) return;
    if (!loaded) loadProducts();
    if (!groupsLoaded) fetchGroups();
  }, [userId, loaded, groupsLoaded]);

  // Logging elsewhere makes "last logged"/"most logged" stale; refresh on return.
  useFocusEffect(
    useCallback(() => {
      if (userId && loaded && statsStale) loadProducts();
    }, [userId, loaded, statsStale]),
  );

  const visibleGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const activeFilters = useMemo(() => effectiveFilters(filters, visibleGroupIds), [filters, visibleGroupIds]);
  const activeFilterCount = countActiveFilters(activeFilters);
  const favoriteCount = useMemo(() => products.filter((p) => p.is_favorite).length, [products]);

  const visibleProducts = useMemo(
    () => sortProducts(applyProductFilters(products, activeFilters, searchQuery), sort),
    [products, activeFilters, searchQuery, sort],
  );

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.short ?? '';
  const isNarrowed = activeFilterCount > 0 || activeFilters.favoritesOnly || searchQuery.trim().length > 0;

  function handleManageGroups() {
    setOpenSheet(null);
    afterSheetClose(() => router.push('/groups'));
  }

  function clearEverything() {
    resetFilters();
    if (activeFilters.favoritesOnly) toggleFavoritesOnly();
    setSearchQuery('');
  }

  return (
    <View style={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{products.length} entries in library</Text>
        <Pressable style={styles.recentlyDeleted} onPress={() => router.push('/recently-deleted')}>
          <MaterialDesignIcons name="archive-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaLabel}>Recently deleted</Text>
        </Pressable>
      </View>

      <TextInput
        placeholder="Search library..."
        placeholderTextColor={colors.placeholder}
        style={styles.searchInput}
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
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
          onPress={toggleFavoritesOnly}
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
        {visibleProducts.length} product{visibleProducts.length === 1 ? '' : 's'}
      </Text>

      {loaded && visibleProducts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.placeholder}>
            {products.length === 0
              ? 'Your product library will appear here.'
              : activeFilters.favoritesOnly && favoriteCount === 0 && activeFilterCount === 0 && !searchQuery.trim()
                ? 'No favourites yet — tap the heart on a product to add it.'
                : 'No products match your search or filters.'}
          </Text>
          {products.length > 0 && isNarrowed && (
            <Pressable onPress={clearEverything} hitSlop={8}>
              <Text style={styles.link}>Clear search & filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductCard item={item} />}
        keyboardShouldPersistTaps="handled"
      />

      <ProductFiltersSheet
        visible={openSheet === 'filters'}
        onClose={() => setOpenSheet(null)}
        products={products}
        groups={groups}
        resultCount={visibleProducts.length}
        onManageGroups={handleManageGroups}
      />
      <ProductSortSheet
        visible={openSheet === 'sort'}
        onClose={() => setOpenSheet(null)}
        resultCount={visibleProducts.length}
      />
    </View>
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
    container: {
      flex: 1,
      padding: Spacing.xl,
      paddingBottom: 0,
      backgroundColor: colors.background,
      gap: Spacing.lg,
    },
    placeholder: { color: colors.textSecondary, textAlign: 'center' },
    emptyState: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xxl },
    link: { ...monoLabel, color: colors.primary },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metaLabel: { ...monoLabel, color: colors.textSecondary },
    recentlyDeleted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
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
