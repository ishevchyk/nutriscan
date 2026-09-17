import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Spacing, ThemeColors } from '../constants/theme';
import { useThemeColor } from '../hooks/useThemeColor';
import { usePickMeal } from '../hooks/usePickMeal';
import { MealSlot, SourceType } from '../store/logStore';
import { MealSlotStep } from '../components/tracker/MealSlotStep';
import { SourceStep } from '../components/tracker/SourceStep';
import { ProductSourceStep } from '../components/tracker/ProductSourceStep';
import { MealSourceStep } from '../components/tracker/MealSourceStep';
import { ManualSourceStep } from '../components/tracker/ManualSourceStep';

type Step = 'slot' | 'source' | 'product' | 'meal' | 'manual';

export default function LogEntryScreen() {
  const { slot: slotParam, mealId: mealIdParam } = useLocalSearchParams<{ slot?: MealSlot; mealId?: string }>();
  const router = useRouter();
  const colors = useThemeColor();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pick: pickMeal } = usePickMeal();

  const [mealSlot, setMealSlot] = useState<MealSlot | null>(slotParam ?? null);
  const [mealId, setMealId] = useState<string | null>(mealIdParam ?? null);
  const [step, setStep] = useState<Step>(() => {
    if (mealIdParam && slotParam) return 'meal';
    if (slotParam) return 'source';
    return 'slot';
  });
  const pickingMeal = useRef(false);

  function handleSlotContinue(slot: MealSlot) {
    setMealSlot(slot);
    setStep(mealId ? 'meal' : 'source');
  }

  function handleSourceSelect(source: SourceType) {
    if (source === 'meal' && !mealId) {
      if (pickingMeal.current) return;
      pickingMeal.current = true;
      pickMeal().then((picked) => {
        pickingMeal.current = false;
        if (!picked) return;
        setMealId(picked.id);
        setStep('meal');
      });
      return;
    }
    setStep(source);
  }

  function handleLogged() {
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {step === 'slot' && <MealSlotStep onContinue={handleSlotContinue} />}
      {step === 'source' && <SourceStep onSelect={handleSourceSelect} />}
      {step === 'product' && mealSlot && (
        <ProductSourceStep mealSlot={mealSlot} onLogged={handleLogged} onCancel={() => setStep('source')} />
      )}
      {step === 'meal' && mealSlot && mealId && (
        <MealSourceStep mealId={mealId} mealSlot={mealSlot} onLogged={handleLogged} />
      )}
      {step === 'meal' && (!mealSlot || !mealId) && (
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      )}
      {step === 'manual' && mealSlot && <ManualSourceStep mealSlot={mealSlot} onLogged={handleLogged} />}
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
    spinner: { marginTop: 40 },
  });
}
