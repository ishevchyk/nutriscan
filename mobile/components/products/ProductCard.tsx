import {memo} from "react";
import {useRouter} from "expo-router";
import {Product, useProductStore} from "../../store/productStore";
import {formatLastLogged} from "../../utils/productFilters";
import {ProductCardBase} from "./ProductCardBase";
import {ProductMacroFooter} from "./ProductMacroFooter";
import {FavoriteButton} from "./FavoriteButton";

type ProductCardProps = {
    item: Product;
};
export const ProductCard = memo(function ProductCard({ item }: ProductCardProps) {
    const router = useRouter();
    const toggleFavorite = useProductStore((s) => s.toggleFavorite);
    const lastLogged = formatLastLogged(item.last_logged_at);

    return (
        <ProductCardBase
            name={item.name}
            brand={item.brand}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
            headerRight={
                // Rollback happens in the store; nothing useful to show on failure here.
                <FavoriteButton favorite={item.is_favorite} onToggle={() => toggleFavorite(item.id).catch(() => {})} />
            }
            footer={
                <ProductMacroFooter
                    calories={item.calories}
                    protein={item.protein}
                    fat={item.fat}
                    carbs={item.carbs}
                />
            }
            meta={lastLogged ? `Last logged ${lastLogged}` : 'Not logged yet'}
        />
    );
});
