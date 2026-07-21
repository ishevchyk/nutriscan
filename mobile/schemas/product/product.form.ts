import { z } from "zod";
import { ProductFields } from "./product.base";

export const ProductFormSchema = z.object({
    name: ProductFields.name,
    brand: ProductFields.brand.optional(),
    calories: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    protein: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    fat: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    carbs: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    fiber: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    sugar: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
    salt: z.coerce.number().nonnegative("Must be 0 or more").nullable(),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
