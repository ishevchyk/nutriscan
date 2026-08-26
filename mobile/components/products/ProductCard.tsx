import {memo} from "react";
import {useRouter} from "expo-router";
import {Product} from "../../store/productStore";
import {ProductCardBase} from "./ProductCardBase";
import {GroupBadgeRow} from "./GroupBadgeRow";
import {ProductMacroFooter} from "./ProductMacroFooter";

type ProductCardProps = {
    item: Product;
};
export const ProductCard = memo(function ProductCard({ item }: ProductCardProps) {
    const router = useRouter();

    return (
        <ProductCardBase
            name={item.name}
            brand={item.brand}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
            badges={<GroupBadgeRow groups={item.groups} />}
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
