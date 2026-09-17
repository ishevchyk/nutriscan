import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { useMealStore, MealSummary } from '../store/mealStore';
import { usePickerStore } from '../store/pickerStore';
import { MealPickerItem } from '../components/tracker/MealPickerItem';

export default function MealPickerScreen() {
  const { meals, loaded, loadMeals } = useMealStore();
  const [query, setQuery] = useState('');
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (!loaded) {
      loadMeals();
    }
  }, [loaded]);

  // Resolves the pick() promise with null if the screen is dismissed
  // (e.g. swipe-back) without an explicit select/cancel action.
  useEffect(() => {
    return () => {
      if (usePickerStore.getState().mealResolver) {
        usePickerStore.getState().resolveMeal(null);
      }
    };
  }, []);

  function handleSelect(meal: MealSummary) {
    usePickerStore.getState().resolveMeal(meal);
    router.back();
  }

  const filtered = meals.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search meals..."
        placeholderTextColor={colors.placeholder}
        value={query}
        onChangeText={setQuery}
        autoFocus
      />

      {loaded && filtered.length === 0 && <Text style={styles.placeholder}>No meals found.</Text>}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MealPickerItem item={item} onSelect={handleSelect} />}
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
