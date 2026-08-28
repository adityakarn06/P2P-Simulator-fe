"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getProduct,
  getSupplier,
  getSupplierProducts,
  listProducts,
  listSuppliers,
  type ListProductsParams,
  type ListSuppliersParams,
} from "@/lib/api/suppliers";
import type {
  Product,
  ProductDetail,
  Supplier,
  SupplierDetail,
  SupplierProductOffer,
} from "@/types/catalog";
import type { CursorPaginatedData } from "@/types/api";

/**
 * The catalog is static reference data — the only runtime writer is
 * `recordGoodsReceipt` maintaining the OTIF counters — so nothing here polls.
 * A long `staleTime` keeps a sourcing screen from refetching the same price
 * list on every mount.
 */
const CATALOG_STALE_MS = 5 * 60 * 1000;

export const catalogKeys = {
  all: ["catalog"] as const,
  supplierLists: () => [...catalogKeys.all, "suppliers"] as const,
  supplierList: (filters: ListSuppliersParams) =>
    [...catalogKeys.supplierLists(), filters] as const,
  supplier: (id: string) => [...catalogKeys.all, "supplier", id] as const,
  supplierProducts: (id: string) =>
    [...catalogKeys.all, "supplier", id, "products"] as const,
  productLists: () => [...catalogKeys.all, "products"] as const,
  productList: (filters: ListProductsParams) =>
    [...catalogKeys.productLists(), filters] as const,
  product: (id: string) => [...catalogKeys.all, "product", id] as const,
} as const;

/** GET /suppliers — the catalog list with OTIF counters. */
export function useSuppliers(
  filters: ListSuppliersParams = {},
  options?: Omit<UseQueryOptions<CursorPaginatedData<Supplier>>, "queryKey" | "queryFn">
) {
  return useQuery<CursorPaginatedData<Supplier>>({
    queryKey: catalogKeys.supplierList(filters),
    queryFn: () => listSuppliers(filters),
    staleTime: CATALOG_STALE_MS,
    ...options,
  });
}

/** GET /suppliers/:id — `{ supplier, scorecard, products }`. */
export function useSupplier(
  id: string,
  options?: Omit<UseQueryOptions<SupplierDetail>, "queryKey" | "queryFn">
) {
  return useQuery<SupplierDetail>({
    queryKey: catalogKeys.supplier(id),
    queryFn: () => getSupplier(id),
    enabled: Boolean(id),
    staleTime: CATALOG_STALE_MS,
    ...options,
  });
}

/**
 * GET /suppliers/:id/products — just the offers.
 * Prefer `useSupplier` when the page also needs the supplier or its scorecard:
 * that one call already carries all three.
 */
export function useSupplierProducts(
  id: string,
  options?: Omit<UseQueryOptions<SupplierProductOffer[]>, "queryKey" | "queryFn">
) {
  return useQuery<SupplierProductOffer[]>({
    queryKey: catalogKeys.supplierProducts(id),
    queryFn: () => getSupplierProducts(id),
    enabled: Boolean(id),
    staleTime: CATALOG_STALE_MS,
    ...options,
  });
}

/** GET /products — cursor-paginated catalog list. */
export function useProducts(
  filters: ListProductsParams = {},
  options?: Omit<UseQueryOptions<CursorPaginatedData<Product>>, "queryKey" | "queryFn">
) {
  return useQuery<CursorPaginatedData<Product>>({
    queryKey: catalogKeys.productList(filters),
    queryFn: () => listProducts(filters),
    staleTime: CATALOG_STALE_MS,
    ...options,
  });
}

/**
 * GET /products/:id — the product plus every supplier offering it, cheapest
 * first then fastest, each with the full supplier row.
 */
export function useProduct(
  id: string,
  options?: Omit<UseQueryOptions<ProductDetail>, "queryKey" | "queryFn">
) {
  return useQuery<ProductDetail>({
    queryKey: catalogKeys.product(id),
    queryFn: () => getProduct(id),
    enabled: Boolean(id),
    staleTime: CATALOG_STALE_MS,
    ...options,
  });
}
