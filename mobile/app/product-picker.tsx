import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useFilteredProducts } from '../hooks/useFilteredProducts';
import { useProductStore, Product } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { usePickerStore } from '../store/pickerStore';
import { useLocalProductFilters } from '../store/productFilterStore';
import { ProductPickerItem } from '../components/products/ProductPickerItem';
import { ProductFilterBar } from '../components/products/ProductFilterBar';

export default function ProductPickerScreen() {
  const { products, loaded, loadProducts } = useProductStore();
  const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
  const [query, setQuery] = useState('');
  // Local to the picker so it doesn't disturb the Products tab's own filters.
  const filterState = useLocalProductFilters();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (!loaded) {
      loadProducts();
    }
    if (!groupsLoaded) {
      fetchGroups();
    }
  }, [loaded, groupsLoaded]);

  // Resolves the pick() promise with null if the screen is dismissed
  // (e.g. swipe-back) without an explicit select/cancel action.
  useEffect(() => {
    return () => {
      if (usePickerStore.getState().resolver) {
        usePickerStore.getState().resolve(null);
      }
    };
  }, []);

  function handleSelect(product: Product) {
    usePickerStore.getState().resolve(product);
    router.back();
  }

  const { activeFilters, activeFilterCount, favoriteCount, visibleProducts } = useFilteredProducts(
    products,
    groups,
    filterState,
    query,
  );

  return (
    <View style={styles.container}>
      <ProductFilterBar
        filterState={filterState}
        activeFilters={activeFilters}
        activeFilterCount={activeFilterCount}
        favoriteCount={favoriteCount}
        products={products}
        groups={groups}
        resultCount={visibleProducts.length}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search products..."
        autoFocus
      />

      {loaded && visibleProducts.length === 0 && <Text style={styles.placeholder}>No products found.</Text>}

      <FlatList
        data={visibleProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductPickerItem item={item} onSelect={handleSelect} />}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background, gap: Spacing.lg },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
