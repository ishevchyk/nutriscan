import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';
import { useGroupStore } from '../../store/groupStore';
import { useProductFilterStore } from '../../store/productFilterStore';
import { ProductCard } from '../../components/products/ProductCard';
import { ProductFilterBar } from '../../components/products/ProductFilterBar';
import { useFilteredProducts } from '../../hooks/useFilteredProducts';

export default function ProductsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { products, loaded, statsStale, loadProducts } = useProductStore();
  const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
  const filterState = useProductFilterStore();
  const { toggleFavoritesOnly, resetFilters } = filterState;
  const [searchQuery, setSearchQuery] = useState('');
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

  const { activeFilters, activeFilterCount, favoriteCount, visibleProducts } = useFilteredProducts(
    products,
    groups,
    filterState,
    searchQuery,
  );
  const isNarrowed = activeFilterCount > 0 || activeFilters.favoritesOnly || searchQuery.trim().length > 0;

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

      <ProductFilterBar
        filterState={filterState}
        activeFilters={activeFilters}
        activeFilterCount={activeFilterCount}
        favoriteCount={favoriteCount}
        products={products}
        groups={groups}
        resultCount={visibleProducts.length}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        searchPlaceholder="Search library..."
      />

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
  });
}
