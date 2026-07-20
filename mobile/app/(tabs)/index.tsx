import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';

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
      <Text style={styles.heading}>My Products</Text>

      {initializing && <ActivityIndicator size="large" color={colors.primary} />}

      {loaded && products.length === 0 && (
        <Text style={styles.placeholder}>Your product library will appear here.</Text>
      )}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.productName}>{item.name}</Text>
            {item.brand && <Text style={styles.brand}>{item.brand}</Text>}
          </View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background },
    heading: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.lg, color: colors.text },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    row: {
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    productName: { fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium, color: colors.text },
    brand: { fontSize: Typography.fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  });
}
