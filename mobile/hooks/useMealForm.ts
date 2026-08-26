import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { MealFormSchema } from '../schemas';
import { Meal } from '../store/mealStore';

export type MealFormInput = z.input<typeof MealFormSchema>;
export type MealFormValues = z.output<typeof MealFormSchema>;

const defaultValues: MealFormInput = {
    name: '',
    description: '',
    photo_url: '',
    servings: 1,
};

export function useMealForm(meal?: Meal) {
    return useForm<MealFormInput, any, MealFormValues>({
        resolver: zodResolver(MealFormSchema),
        defaultValues,
        values: meal
            ? {
                name: meal.name,
                description: meal.description,
                photo_url: meal.photo_url,
                servings: meal.servings,
            }
            : undefined,
        // Ingredient operations refresh the selected meal, which re-applies
        // `values`; without this, unsaved name/steps/servings edits would be
        // clobbered mid-edit.
        resetOptions: { keepDirtyValues: true },
    });
}
