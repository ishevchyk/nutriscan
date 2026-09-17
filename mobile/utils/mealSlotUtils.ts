import { MealSlot } from '../store/logStore';

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/** Client-side guess at meal slot from local time of day, retunable here.
 * 05:00-10:59 breakfast, 11:00-14:59 lunch, 15:00-21:59 dinner, else snack. */
export function getDefaultMealSlotForTime(date: Date = new Date()): MealSlot {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 22) return 'dinner';
  return 'snack';
}
