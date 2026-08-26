import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useProductStore, Product } from '../store/productStore';
import { usePickerStore } from '../store/pickerStore';
import { ProductPickerItem } from '../components/products/ProductPickerItem';

export default function ProductPickerScreen() {
  const { products, loaded, loadProducts } = useProductStore();
  const [query, setQuery] = useState('');
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (!loaded) {
      loadProducts();
    }
  }, [loaded]);

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

  const filtered = products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

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
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  });
}
