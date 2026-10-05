import { useRouter } from 'expo-router';

import { AddProductResult, usePickerStore } from '../store/pickerStore';

/** Opens the add-product screen and resolves with the user's choice: save to
 * library (linked) or, for meals, save to meal only (unlinked). The product
 * picker passes `libraryOnly` (no meal-only option) and the search text as
 * `name` to prefill the form. */
export function useAddProductForMeal() {
  const router = useRouter();

  function addProductForMeal(options?: { libraryOnly?: boolean; name?: string }): Promise<AddProductResult> {
    return new Promise((resolve) => {
      usePickerStore.getState().setAddProductResolver(resolve);
      router.push({
        pathname: '/add-product',
        params: {
          forMeal: '1',
          ...(options?.libraryOnly ? { libraryOnly: '1' } : {}),
          ...(options?.name ? { name: options.name } : {}),
        },
      });
    });
  }

  return { addProductForMeal };
}
