import { z } from "zod";

// Define each field's validation rule ONCE. Every other schema derives from this.
export const ProductFields = {
    name: z.string().min(1, "Product name is required"),
    brand: z.string().nullable(),
    barcode: z.string().nullable(),
    calories: z.number().nonnegative().nullable(),
    protein: z.number().nonnegative().nullable(),
    fat: z.number().nonnegative().nullable(),
    carbs: z.number().nonnegative().nullable(),
    fiber: z.number().nonnegative().nullable(),
    sugar: z.number().nonnegative().nullable(),
    salt: z.number().nonnegative().nullable(),
    notes: z.string().nullable(),
};

export const ProductBase = z.object(ProductFields);
