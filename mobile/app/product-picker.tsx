import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProductStore, Product } from '../store/productStore';
import { useGroupStore } from '../store/groupStore';
import { usePickerStore } from '../store/pickerStore';
import { ProductPickerItem } from '../components/products/ProductPickerItem';
import { GroupFilterChips } from '../components/groups/GroupFilterChips';

export default function ProductPickerScreen() {
  const { products, loaded, loadProducts } = useProductStore();
  const { groups, loaded: groupsLoaded, fetchGroups } = useGroupStore();
  const [query, setQuery] = useState('');
  // Local to the picker so it doesn't disturb the Products tab's own group filter.
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (groupFilter && !p.groups.some((g) => g.id === groupFilter)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q);
    });
  }, [products, query, groupFilter]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        placeholderTextColor={colors.placeholder}
        value={query}
        onChangeText={setQuery}
        autoFocus
      />

      <View style={styles.groupsContainer}>
        <GroupFilterChips
          groups={groups}
          loaded={groupsLoaded}
          activeGroupFilter={groupFilter}
          onSelect={setGroupFilter}
        />
      </View>

      {loaded && filtered.length === 0 && <Text style={styles.placeholder}>No products found.</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ProductPickerItem item={item} onSelect={handleSelect} />}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background },
    searchInput: {
      height: 44,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      marginBottom: Spacing.lg,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    groupsContainer: { marginBottom: Spacing.md },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
