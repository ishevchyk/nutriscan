import { memo } from 'react';

import { Product } from '../../store/productStore';
import { ProductCardBase } from './ProductCardBase';
import { ProductMacroFooter } from './ProductMacroFooter';

type ProductPickerItemProps = {
    item: Product;
    onSelect: (product: Product) => void;
};

export const ProductPickerItem = memo(function ProductPickerItem({ item, onSelect }: ProductPickerItemProps) {
    return (
        <ProductCardBase
            name={item.name}
            brand={item.brand}
            onPress={() => onSelect(item)}
            footer={
                <ProductMacroFooter
                    calories={item.calories}
                    protein={item.protein}
                    fat={item.fat}
                    carbs={item.carbs}
                />
            }
        />
    );
});
