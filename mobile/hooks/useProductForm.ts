import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { ProductFormSchema } from '../schemas';
import { Product } from '../store/productStore';

export type ProductFormInput = z.input<typeof ProductFormSchema>;
export type ProductFormValues = z.output<typeof ProductFormSchema>;

const defaultValues: ProductFormInput = {
    name: '',
    brand: '',
    barcode: null,
    calories: null,
    protein: null,
    fat: null,
    carbs: null,
    fiber: null,
    sugar: null,
    salt: null,
    saturated_fat: null,
    nutrients: {},
    notes: '',
};

export function useProductForm(product?: Product, initialName?: string) {
    return useForm<ProductFormInput, any, ProductFormValues>({
        resolver: zodResolver(ProductFormSchema),
        // Autosave updates the product (and so `values`) while the user is still
        // typing elsewhere; never clobber fields they've edited.
        resetOptions: { keepDirtyValues: true },
        defaultValues: initialName ? { ...defaultValues, name: initialName } : defaultValues,
        values: product
            ? {
                name: product.name,
                brand: product.brand,
                barcode: product.barcode,
                calories: product.calories,
                protein: product.protein,
                fat: product.fat,
                carbs: product.carbs,
                fiber: product.fiber,
                sugar: product.sugar,
                salt: product.salt,
                saturated_fat: product.saturated_fat,
                nutrients: product.nutrients,
                notes: product.notes,
            }
            : undefined,
    });
}
