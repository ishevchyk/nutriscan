import { useEffect, useMemo, useState } from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View} from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';
import {ProductCard} from "../../components/products/ProductCard";

export default function ProductsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { products, loaded, loadProducts } = useProductStore();
  const [initializing, setInitializing] = useState(true);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      loadProducts().finally(() => setInitializing(false));
    }
  }, [userId]);

  return (
    <View style={styles.container}>
      <TextInput placeholder="Search products..." style={styles.searchInput}/>

      {initializing && <ActivityIndicator size="large" color={colors.primary} />}

      {loaded && products.length === 0 && (
        <Text style={styles.placeholder}>Your product library will appear here.</Text>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
            <ProductCard item={item} />
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {flex: 1, padding: Spacing.xl, backgroundColor: colors.background},
    heading: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      marginBottom: Spacing.lg,
      color: colors.text
    },
    placeholder: {color: colors.textSecondary, textAlign: 'center', marginTop: 40},
    searchInput: {
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      marginBottom: Spacing.lg,
      backgroundColor: colors.surface,
    }
  });
}
