import { useRouter } from 'expo-router';

import { AddProductResult, usePickerStore } from '../store/pickerStore';

/** Opens the add-product screen in for-meal mode and resolves with the
 * user's choice: save to library (linked) or save to meal only (unlinked). */
export function useAddProductForMeal() {
  const router = useRouter();

  function addProductForMeal(): Promise<AddProductResult> {
    return new Promise((resolve) => {
      usePickerStore.getState().setAddProductResolver(resolve);
      router.push({ pathname: '/add-product', params: { forMeal: '1' } });
    });
  }

  return { addProductForMeal };
}
