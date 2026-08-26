import { useRouter } from 'expo-router';

import { Product } from '../store/productStore';
import { usePickerStore } from '../store/pickerStore';

export function usePickProduct() {
  const router = useRouter();

  function pick(): Promise<Product | null> {
    return new Promise((resolve) => {
      usePickerStore.getState().setResolver(resolve);
      router.push('/product-picker');
    });
  }

  return { pick };
}
