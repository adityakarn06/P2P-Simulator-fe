import { apiClient } from "./client";
import type { CursorPaginatedData } from "@/types/api";
import type {
  Product,
  ProductDetail,
  Supplier,
  SupplierDetail,
  SupplierProductOffer,
} from "@/types/catalog";

/**
 * The enterprise supplier/product catalog, read-only.
 * Source of truth: backend-docs/suppliers-api.md.
 *
 * There are no writes by design — a mutable price or stock level would
 * silently change what the next requisition buys with nothing in the audit log
 * to explain it. Do not add a mutation to this module.
 */

export interface ListSuppliersParams {
  /** Case-insensitive substring of the supplier name. Empty string is a 400. */
  q?: string;
  isActive?: boolean;
  /** 0–5 */
  minRating?: number;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

export interface ListProductsParams {
  /** Matches name or SKU. Empty string is a 400. */
  q?: string;
  category?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

interface SupplierListEnvelope {
  suppliers: Supplier[];
  nextCursor: string | null;
}

interface SupplierProductsEnvelope {
  products: SupplierProductOffer[];
}

interface ProductListEnvelope {
  products: Product[];
  nextCursor: string | null;
}

function withQuery(path: string, search: URLSearchParams): string {
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * GET /api/v1/suppliers
 * Cursor-paginated catalog list with the OTIF counters on each row.
 */
export async function listSuppliers(
  params: ListSuppliersParams = {}
): Promise<CursorPaginatedData<Supplier>> {
  const search = new URLSearchParams();
  // Only send `q` when it has content — the API 400s an empty string rather
  // than treating it as "no filter".
  if (params.q) search.set("q", params.q);
  if (params.isActive !== undefined) search.set("isActive", String(params.isActive));
  if (params.minRating !== undefined) search.set("minRating", String(params.minRating));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const envelope = await apiClient.get<SupplierListEnvelope>(
    withQuery("/suppliers", search)
  );
  return { items: envelope.suppliers, nextCursor: envelope.nextCursor };
}

/**
 * GET /api/v1/suppliers/:id
 * `{ supplier, scorecard, products }`. The scorecard is the same row
 * GET /analytics/suppliers returns, so it can never disagree with the figures
 * supplier ranking uses; it is null for a supplier with no scorecard yet.
 */
export async function getSupplier(id: string): Promise<SupplierDetail> {
  return apiClient.get<SupplierDetail>(`/suppliers/${id}`);
}

/**
 * GET /api/v1/suppliers/:id/products
 * Just the offers. A foreign supplier id is a 404, not an empty list — an
 * empty list would read as "this supplier stocks nothing".
 */
export async function getSupplierProducts(id: string): Promise<SupplierProductOffer[]> {
  const envelope = await apiClient.get<SupplierProductsEnvelope>(
    `/suppliers/${id}/products`
  );
  return envelope.products;
}

/** GET /api/v1/products — cursor-paginated catalog list. */
export async function listProducts(
  params: ListProductsParams = {}
): Promise<CursorPaginatedData<Product>> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const envelope = await apiClient.get<ProductListEnvelope>(
    withQuery("/products", search)
  );
  return { items: envelope.products, nextCursor: envelope.nextCursor };
}

/**
 * GET /api/v1/products/:id
 * `{ product, offers }` with every supplier offering it, ordered cheapest
 * first then fastest — the same ordering supplier discovery starts from. Each
 * offer carries the full supplier row, so price can be shown against
 * reliability without a second request.
 */
export async function getProduct(id: string): Promise<ProductDetail> {
  return apiClient.get<ProductDetail>(`/products/${id}`);
}
