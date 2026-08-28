"use client";

import { useMemo } from "react";
import { useProducts } from "@/hooks/use-catalog";
import { useCatalogStore, CATEGORY_FILTER_ALL } from "@/store/catalog-store";
import { getCategories, toSearchParam } from "@/lib/state/catalog-state";

/**
 * The /products screen's filters and data.
 *
 * There is no categories endpoint, so the options are derived from product rows.
 * They come from a *second, category-unfiltered* query rather than from the
 * filtered rows on screen: deriving them from the filtered set would leave the
 * select holding only the category already chosen, with no way back to the
 * others. When no category is selected the two queries share a cache key and
 * TanStack serves both from one request.
 */
export function useProductList() {
  const query = useCatalogStore((s) => s.productQuery);
  const setQuery = useCatalogStore((s) => s.setProductQuery);
  const category = useCatalogStore((s) => s.category);
  const setCategory = useCatalogStore((s) => s.setCategory);

  const q = toSearchParam(query);

  const optionsQuery = useProducts({ q, limit: 100 });
  const result = useProducts({
    q,
    category: category === CATEGORY_FILTER_ALL ? undefined : category,
    limit: 100,
  });

  const categories = useMemo(
    () => getCategories(optionsQuery.data?.items ?? []),
    [optionsQuery.data]
  );

  return { query, setQuery, category, setCategory, categories, ...result };
}
