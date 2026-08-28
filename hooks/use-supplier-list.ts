"use client";

import { useSuppliers } from "@/hooks/use-catalog";
import { useCatalogStore } from "@/store/catalog-store";
import { toSearchParam } from "@/lib/state/catalog-state";

/**
 * The /suppliers screen's filters and data. The query is sent straight through
 * rather than debounced — the catalog is a seeded table of a few dozen rows,
 * and TanStack Query keeps the previous page's results on screen while the next
 * key resolves.
 */
export function useSupplierList() {
  const query = useCatalogStore((s) => s.supplierQuery);
  const setQuery = useCatalogStore((s) => s.setSupplierQuery);
  const activeOnly = useCatalogStore((s) => s.activeOnly);
  const setActiveOnly = useCatalogStore((s) => s.setActiveOnly);

  const result = useSuppliers({
    // Omitted entirely when blank: the API 400s an empty `q`.
    q: toSearchParam(query),
    isActive: activeOnly ? true : undefined,
    limit: 100,
  });

  return { query, setQuery, activeOnly, setActiveOnly, ...result };
}
