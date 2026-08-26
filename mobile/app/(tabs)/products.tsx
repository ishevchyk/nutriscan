import { useEffect, useMemo, useState } from 'react';
import {ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useRouter} from 'expo-router';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useProductStore } from '../../store/productStore';
import { useGroupStore } from '../../store/groupStore';
import {ProductCard} from "../../components/products/ProductCard";
import {GroupFilterChips} from "../../components/groups/GroupFilterChips";

export default function ProductsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { products, loaded, loadProducts } = useProductStore();
  const { groups, loaded: groupsLoaded, fetchGroups, activeGroupFilter, setActiveGroupFilter } = useGroupStore();
  const [initializing, setInitializing] = useState(true);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (userId) {
      fetchGroups();
      loadProducts().finally(() => setInitializing(false));
    }
  }, [userId]);

  async function handleFilterSelect(groupId: string | null) {
    setActiveGroupFilter(groupId);
    await loadProducts(groupId ?? undefined);
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

      <TextInput placeholder="Search library..." style={styles.searchInput}/>

      <View style={styles.groupsContainer}>
        <View style={styles.groupsHeader}>
          <Text style={styles.metaLabel}>Groups</Text>
          <Pressable onPress={() => router.push('/groups')}>
            <Text style={styles.manageLink}>Manage</Text>
          </Pressable>
        </View>
        <GroupFilterChips
          groups={groups}
          loaded={groupsLoaded}
          activeGroupFilter={activeGroupFilter}
          onSelect={handleFilterSelect}
        />
      </View>

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
    container: {
      flex: 1,
      padding: Spacing.xl,
      paddingBottom: 0,
      backgroundColor: colors.background,
      gap: Spacing.lg
    },
    heading: {
      fontSize: Typography.fontSize.xl,
      fontWeight: Typography.fontWeight.bold,
      color: colors.text
    },
    placeholder: {color: colors.textSecondary, textAlign: 'center', marginTop: 40},
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    metaLabel: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
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
    },
    groupsContainer: {
      gap: Spacing.sm,
    },
    groupsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    manageLink: {
      fontFamily: Typography.fontFamily.mono,
      fontSize: Typography.fontSize.xxs,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: Typography.letterSpacing.label,
    },
  });
}
