import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../../constants/theme';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useLogStore, LogEntry, MEAL_SLOTS, MealSlot } from '../../store/logStore';
import { useGoalStore } from '../../store/goalStore';
import { useProductStore } from '../../store/productStore';
import { useMealStore } from '../../store/mealStore';
import { addDays, formatDateLabel } from '../../utils/dateUtils';
import { scaleMealIngredientsToTotal } from '../../utils/logUtils';
import { DateNavigator } from '../../components/tracker/DateNavigator';
import { CalendarView } from '../../components/tracker/CalendarView';
import { CaloriesSummaryCard } from '../../components/tracker/CaloriesSummaryCard';
import { MealSlotSection } from '../../components/tracker/MealSlotSection';

export default function TrackerScreen() {
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const {
    date,
    entriesBySlot,
    summary,
    loaded,
    loading,
    summaryLoading,
    setDate,
    loadDay,
    fetchSummary,
    removeEntry,
    updateEntry,
    ensureMealDefaults,
    mealDefaultsCache,
  } = useLogStore();
  const { loaded: goalsLoaded, loadGoal } = useGoalStore();
  const { products, loaded: productsLoaded, loadProducts } = useProductStore();
  const { meals, loaded: mealsLoaded, loadMeals } = useMealStore();

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    if (!loaded) {
      loadDay();
      fetchSummary();
    }
    if (!goalsLoaded) loadGoal();
    if (!productsLoaded) loadProducts();
    if (!mealsLoaded) loadMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mealIds = useMemo(() => {
    const ids = new Set<string>();
    for (const slot of MEAL_SLOTS) {
      for (const entry of entriesBySlot[slot]) {
        if (entry.source_type === 'meal' && entry.meal_id) ids.add(entry.meal_id);
      }
    }
    return ids;
  }, [entriesBySlot]);

  useEffect(() => {
    mealIds.forEach((mealId) => {
      if (!mealDefaultsCache[mealId]) {
        ensureMealDefaults(mealId);
      }
    });
  }, [mealIds]);

  const entryCount = MEAL_SLOTS.reduce((sum, slot) => sum + entriesBySlot[slot].length, 0);

  function handlePrev() {
    setDate(addDays(date, -1));
  }

  function handleNext() {
    setDate(addDays(date, 1));
  }

  function handleAddToSlot(slot: MealSlot) {
    router.push({ pathname: '/log-entry', params: { slot } });
  }

  function handleUpdateAmount(entry: LogEntry, grams: number) {
    if (entry.source_type === 'product') {
      updateEntry(entry.id, { quantity_grams: grams });
      return;
    }
    const overrides = scaleMealIngredientsToTotal(entry, grams);
    if (overrides) updateEntry(entry.id, { quantity_grams: grams, ingredient_overrides: overrides });
  }

  function handleDelete(id: string, slot: MealSlot) {
    Alert.alert('Delete entry?', 'This log entry will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeEntry(id, slot),
      },
    ]);
  }

  if (!loaded || !goalsLoaded || !productsLoaded || !mealsLoaded) {
    return <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.tapCatcher} onPress={() => Keyboard.dismiss()}>
        <DateNavigator
          dateLabel={formatDateLabel(date)}
          entryCount={entryCount}
          onPrev={handlePrev}
          onNext={handleNext}
          isCalendarOpen={isCalendarOpen}
          onToggleCalendar={() => setIsCalendarOpen((open) => !open)}
        />

        {isCalendarOpen && <CalendarView selectedDate={date} onSelectDate={setDate} />}

        {loading || summaryLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.dayIndicator} />
        ) : (
          <>
            <CaloriesSummaryCard totals={summary?.totals ?? { calories: 0, protein: 0, fat: 0, carbs: 0 }} goals={summary?.goals ?? null} />

            {MEAL_SLOTS.map((slot) => (
              <MealSlotSection
                key={slot}
                slot={slot}
                entries={entriesBySlot[slot]}
                products={products}
                meals={meals}
                mealDefaultsCache={mealDefaultsCache}
                onAddPress={() => handleAddToSlot(slot)}
                onDeleteEntry={(id) => handleDelete(id, slot)}
                onUpdateAmount={handleUpdateAmount}
              />
            ))}
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: Spacing.xl,
      backgroundColor: colors.pageBackground,
      paddingBottom: Spacing.xl * 2,
    },
    tapCatcher: { gap: Spacing.lg },
    spinner: { marginTop: 40 },
    dayIndicator: { marginTop: Spacing.xl },
  });
}
