import { z } from "zod";
import { RecipeFields } from "./recipe.base";

export const RecipeFormSchema = z.object({
    name: RecipeFields.name,
    description: RecipeFields.description.optional(),
    photo_url: RecipeFields.photo_url.optional(),
    servings: RecipeFields.servings.default(1),
});

export type RecipeFormValues = z.infer<typeof RecipeFormSchema>;
