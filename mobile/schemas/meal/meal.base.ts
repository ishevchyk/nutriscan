import { z } from "zod";

// Define each field's validation rule ONCE. Every other schema derives from this.
export const MealFields = {
    name: z.string().min(1, "Meal name is required"),
    description: z.string().nullable(),
    photo_url: z.string().nullable(),
    servings: z.number().int().min(1, "At least 1 serving"),
};

export const MealBase = z.object(MealFields);
