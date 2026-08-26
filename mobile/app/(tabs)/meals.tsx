import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons';

import { Spacing, ThemeColors, Typography } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useAuthStore } from '../../store/authStore';
import { useMealStore } from '../../store/mealStore';
import { MealCard } from '../../components/meals/MealCard';

export default function MealsScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { meals, loaded, loadMeals } = useMealStore();
  const [initializing, setInitializing] = useState(true);
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (userId) {
      loadMeals().finally(() => setInitializing(false));
    }
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>{meals.length} meals</Text>
        <Pressable style={styles.recentlyDeleted} onPress={() => router.push('/recently-deleted')}>
          <MaterialDesignIcons name="archive-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaLabel}>Recently deleted</Text>
        </Pressable>
      </View>

      <TextInput placeholder="Search meals..." style={styles.searchInput} />

      {initializing && <ActivityIndicator size="large" color={colors.primary} />}

      {loaded && meals.length === 0 && (
        <Text style={styles.placeholder}>Your meals will appear here.</Text>
      )}

      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MealCard item={item} />}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, backgroundColor: colors.background },
    placeholder: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
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
      marginBottom: Spacing.lg,
      backgroundColor: colors.surface,
    },
  });
}
