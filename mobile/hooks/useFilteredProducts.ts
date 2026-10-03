import { useMemo } from 'react';

import { Product } from '../store/productStore';
import { Group } from '../store/types';
import { ProductFilterState } from '../store/productFilterStore';
import { applyProductFilters, countActiveFilters, effectiveFilters, sortProducts } from '../utils/productFilters';

/** Search + filter + sort pipeline shared by the Products tab and the product picker. */
export function useFilteredProducts(
  products: Product[],
  groups: Group[],
  { filters, sort }: Pick<ProductFilterState, 'filters' | 'sort'>,
  query: string,
) {
  const visibleGroupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const activeFilters = useMemo(() => effectiveFilters(filters, visibleGroupIds), [filters, visibleGroupIds]);
  const favoriteCount = useMemo(() => products.filter((p) => p.is_favorite).length, [products]);
  const visibleProducts = useMemo(
    () => sortProducts(applyProductFilters(products, activeFilters, query), sort),
    [products, activeFilters, query, sort],
  );

  return {
    activeFilters,
    activeFilterCount: countActiveFilters(activeFilters),
    favoriteCount,
    visibleProducts,
  };
}
