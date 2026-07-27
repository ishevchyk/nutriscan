import { z } from "zod";
import { ProductFields } from "./product.base";

export const ProductFormSchema = z.object({
    name: ProductFields.name,
    brand: ProductFields.brand.optional(),
    barcode: ProductFields.barcode.optional(),
    calories: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    protein: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    fat: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    carbs: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    fiber: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    sugar: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    salt: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    notes: ProductFields.notes.optional(),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
