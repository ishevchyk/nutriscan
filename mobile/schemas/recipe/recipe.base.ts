import { z } from "zod";

// Define each field's validation rule ONCE. Every other schema derives from this.
export const RecipeFields = {
    name: z.string().min(1, "Recipe name is required"),
    description: z.string().nullable(),
    photo_url: z.string().nullable(),
    servings: z.number().int().min(1, "At least 1 serving"),
};

export const RecipeBase = z.object(RecipeFields);
