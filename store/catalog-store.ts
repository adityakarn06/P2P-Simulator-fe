import { create } from "zustand";

/**
 * Client/UI state for the supplier and product catalog screens. Server data
 * stays in hooks/use-catalog.ts.
 *
 * The two search boxes are kept apart rather than sharing one field: /suppliers
 * matches a supplier name and /products matches a name or SKU, so carrying a
 * query across the tabs would silently apply it to a different column.
 */

/** Sentinel for the "no filter" option in the category select. */
export const CATEGORY_FILTER_ALL = "__all__" as const;

interface CatalogState {
  supplierQuery: string;
  setSupplierQuery: (q: string) => void;
  /** Hide deactivated suppliers. Off by default — the catalog is reference data. */
  activeOnly: boolean;
  setActiveOnly: (v: boolean) => void;

  productQuery: string;
  setProductQuery: (q: string) => void;
  category: string;
  setCategory: (v: string) => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  supplierQuery: "",
  setSupplierQuery: (supplierQuery) => set({ supplierQuery }),
  activeOnly: false,
  setActiveOnly: (activeOnly) => set({ activeOnly }),

  productQuery: "",
  setProductQuery: (productQuery) => set({ productQuery }),
  category: CATEGORY_FILTER_ALL,
  setCategory: (category) => set({ category }),
}));
