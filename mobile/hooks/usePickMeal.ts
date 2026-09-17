import { useRouter } from 'expo-router';

import { MealSummary } from '../store/mealStore';
import { usePickerStore } from '../store/pickerStore';

export function usePickMeal() {
  const router = useRouter();

  function pick(): Promise<MealSummary | null> {
    return new Promise((resolve) => {
      usePickerStore.getState().setMealResolver(resolve);
      router.push('/meal-picker');
    });
  }

  return { pick };
}
