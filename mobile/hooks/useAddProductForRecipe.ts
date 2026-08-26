import { useRouter } from 'expo-router';

import { AddProductResult, usePickerStore } from '../store/pickerStore';

/** Opens the add-product screen in for-recipe mode and resolves with the
 * user's choice: save to library (linked) or save to recipe only (unlinked). */
export function useAddProductForRecipe() {
  const router = useRouter();

  function addProductForRecipe(): Promise<AddProductResult> {
    return new Promise((resolve) => {
      usePickerStore.getState().setAddProductResolver(resolve);
      router.push({ pathname: '/add-product', params: { forRecipe: '1' } });
    });
  }

  return { addProductForRecipe };
}
