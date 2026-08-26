import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { RecipeFormSchema } from '../schemas';
import { Recipe } from '../store/recipeStore';

export type RecipeFormInput = z.input<typeof RecipeFormSchema>;
export type RecipeFormValues = z.output<typeof RecipeFormSchema>;

const defaultValues: RecipeFormInput = {
    name: '',
    description: '',
    photo_url: '',
    servings: 1,
};

export function useRecipeForm(recipe?: Recipe) {
    return useForm<RecipeFormInput, any, RecipeFormValues>({
        resolver: zodResolver(RecipeFormSchema),
        defaultValues,
        values: recipe
            ? {
                name: recipe.name,
                description: recipe.description,
                photo_url: recipe.photo_url,
                servings: recipe.servings,
            }
            : undefined,
        // Ingredient operations refresh the selected recipe, which re-applies
        // `values`; without this, unsaved name/steps/servings edits would be
        // clobbered mid-edit.
        resetOptions: { keepDirtyValues: true },
    });
}
