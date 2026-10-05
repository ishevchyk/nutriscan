import { z } from "zod";
import { ProductFields } from "./product.base";

// Optional facts keep null (= unknown) instead of coercing it to 0: z.coerce
// would turn null/'' into 0, which means "measured zero". The four macros the
// app calculates with keep the 0 default below.
const optionalAmount = z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.coerce.number().nonnegative("Must be 0 or more").nullable(),
);

export const ProductFormSchema = z.object({
    name: ProductFields.name,
    brand: ProductFields.brand.optional(),
    barcode: ProductFields.barcode.optional(),
    calories: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    protein: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    fat: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    carbs: z.coerce.number().nonnegative("Must be 0 or more").nullable().transform((v) => v ?? 0),
    fiber: optionalAmount,
    sugar: optionalAmount,
    salt: optionalAmount,
    saturated_fat: optionalAmount,
    nutrients: z.record(z.string(), optionalAmount).optional(),
    notes: ProductFields.notes.optional(),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
