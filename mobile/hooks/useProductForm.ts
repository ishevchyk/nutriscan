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
    notes: '',
};

export function useProductForm(product?: Product) {
    return useForm<ProductFormInput, any, ProductFormValues>({
        resolver: zodResolver(ProductFormSchema),
        defaultValues,
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
                notes: product.notes,
            }
            : undefined,
    });
}
