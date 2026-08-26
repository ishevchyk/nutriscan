import { z } from "zod";
import { MealFields } from "./meal.base";

export const MealFormSchema = z.object({
    name: MealFields.name,
    description: MealFields.description.optional(),
    photo_url: MealFields.photo_url.optional(),
    servings: MealFields.servings.default(1),
});

export type MealFormValues = z.infer<typeof MealFormSchema>;
