/**
 * Supplier and product catalog types — the enterprise catalog that supplier
 * discovery ranks against, exposed read-only.
 *
 * Source of truth: backend-docs/suppliers-api.md. Read-only on purpose: a
 * mutable price or stock level would silently change what the next requisition
 * buys, with nothing in the audit log to explain it.
 */

import type { SupplierScorecardRow } from "./analytics";

/**
 * A catalog supplier, including the OTIF counters `recordGoodsReceipt`
 * maintains. `reliabilityScore` is the live figure; `baselineReliability` is
 * what the supplier was onboarded with — the delta between them is the
 * earned-vs-claimed reliability story.
 */
export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** 0–5 */
  rating: number;
  /** 0–1 */
  reliabilityScore: number;
  /** 0–1, the onboarding baseline */
  baselineReliability: number;
  isActive: boolean;
  totalDeliveries: number;
  onTimeDeliveries: number;
  inFullDeliveries: number;
  orderedUnits: number;
  acceptedUnits: number;
  damagedUnits: number;
  avgLeadTimeDays: number | null;
  /** ISO 8601 or null */
  lastDeliveryAt: string | null;
  /** Only on the list endpoint. */
  _count?: { supplierProducts: number };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
}

/**
 * One supplier's offer for one product. `unitPricePaise` is integer paise.
 * Returned by `GET /suppliers/:id/products` (carrying `product`) and inside
 * `GET /suppliers/:id`.
 */
export interface SupplierProductOffer {
  id: string;
  unitPricePaise: number;
  currency: string;
  stockQuantity: number;
  deliveryDays: number;
  minOrderQuantity: number;
  /** ISO 8601 */
  updatedAt: string;
  product: Product;
}

/**
 * The same offer seen from the product's side — `GET /products/:id` orders
 * these cheapest first, then fastest (the ordering supplier discovery starts
 * from) and carries the full supplier row, so a sourcing screen can show price
 * against reliability without a second request.
 */
export interface ProductSupplierOffer {
  id: string;
  unitPricePaise: number;
  currency: string;
  stockQuantity: number;
  deliveryDays: number;
  minOrderQuantity: number;
  /** ISO 8601 */
  updatedAt: string;
  supplier: Supplier;
}

/**
 * `GET /suppliers/:id`. `scorecard` is the very same row `GET /analytics/suppliers`
 * returns — reused rather than recomputed, so it can never disagree with the
 * figures supplier ranking actually uses. `null` for a supplier with no
 * scorecard yet.
 */
export interface SupplierDetail {
  supplier: Supplier;
  scorecard: SupplierScorecardRow | null;
  products: SupplierProductOffer[];
}

/** `GET /products/:id`. */
export interface ProductDetail {
  product: Product;
  offers: ProductSupplierOffer[];
}
