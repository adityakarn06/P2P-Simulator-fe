import type {
  ProductSupplierOffer,
  Supplier,
  SupplierProductOffer,
} from "@/types/catalog";

/**
 * Derivation logic for the supplier/product catalog screens, kept free of React
 * so it can be unit tested directly (see __tests__/catalog-state.test.ts).
 *
 * Source of truth: backend-docs/suppliers-api.md. The catalog is static
 * reference data — the only runtime writer is `recordGoodsReceipt` maintaining
 * the OTIF counters — so nothing here is polled.
 */

/**
 * On-time rate as a 0–1 fraction, or null when the supplier has never
 * delivered. Null rather than 0: a supplier with no deliveries has not failed
 * to deliver on time, and rendering "0%" would libel a new vendor.
 */
export function getOnTimeRate(
  supplier: Pick<Supplier, "totalDeliveries" | "onTimeDeliveries">
): number | null {
  if (supplier.totalDeliveries <= 0) return null;
  return supplier.onTimeDeliveries / supplier.totalDeliveries;
}

/** In-full rate as a 0–1 fraction, or null when the supplier has never delivered. */
export function getInFullRate(
  supplier: Pick<Supplier, "totalDeliveries" | "inFullDeliveries">
): number | null {
  if (supplier.totalDeliveries <= 0) return null;
  return supplier.inFullDeliveries / supplier.totalDeliveries;
}

/**
 * Share of ordered units that arrived undamaged, 0–1, or null when nothing has
 * been ordered yet.
 */
export function getAcceptanceRate(
  supplier: Pick<Supplier, "orderedUnits" | "acceptedUnits">
): number | null {
  if (supplier.orderedUnits <= 0) return null;
  return supplier.acceptedUnits / supplier.orderedUnits;
}

/**
 * How far the supplier's earned reliability has drifted from the reliability it
 * was onboarded with. Positive means it is outperforming its baseline.
 *
 * Returned as a raw signed fraction — the caller formats it. Kept separate from
 * `reliabilityScore` because the delta, not the absolute score, is what says
 * whether a vendor is getting better or worse.
 */
export function getReliabilityDelta(
  supplier: Pick<Supplier, "reliabilityScore" | "baselineReliability">
): number {
  return supplier.reliabilityScore - supplier.baselineReliability;
}

/** Formats a 0–1 rate as a percentage, or an em dash when there is no data. */
export function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(0)}%`;
}

/** Formats a signed 0–1 delta as a percentage-point string, e.g. "+2 pts". */
export function formatReliabilityDelta(delta: number): string {
  const points = delta * 100;
  // Anything under half a point rounds to "0" and reads as a change when it
  // isn't one, so say "no change" explicitly instead.
  if (Math.abs(points) < 0.5) return "no change";
  const rounded = Math.round(points);
  return `${rounded > 0 ? "+" : ""}${rounded} pts`;
}

/**
 * True when an offer can actually satisfy a quantity: enough stock, and at or
 * above the supplier's minimum order. Advisory only — supplier discovery runs
 * server-side and this never decides what gets bought.
 */
export function canFulfil(
  offer: Pick<SupplierProductOffer, "stockQuantity" | "minOrderQuantity">,
  quantity: number
): boolean {
  return quantity >= offer.minOrderQuantity && quantity <= offer.stockQuantity;
}

/**
 * The cheapest offer in a list, or null when the list is empty.
 * Ties break on the shorter lead time — the same ordering supplier discovery
 * starts from, so a catalog screen and the sourcing engine agree on "best".
 */
export function getCheapestOffer<
  T extends Pick<ProductSupplierOffer, "unitPricePaise" | "deliveryDays">,
>(offers: T[]): T | null {
  if (offers.length === 0) return null;
  return offers.reduce((best, offer) => {
    if (offer.unitPricePaise !== best.unitPricePaise) {
      return offer.unitPricePaise < best.unitPricePaise ? offer : best;
    }
    return offer.deliveryDays < best.deliveryDays ? offer : best;
  });
}

/**
 * The distinct categories present in a product list, sorted, with nulls
 * dropped. Derived from the loaded page only — there is no categories endpoint,
 * so this must never be presented as the complete catalog taxonomy.
 */
export function getCategories(products: { category: string | null }[]): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    if (product.category) seen.add(product.category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Normalises a search box's value for the `q` parameter: trimmed, and undefined
 * when empty. The API 400s an empty `q` rather than treating it as "no filter",
 * so a blank box must omit the parameter entirely.
 */
export function toSearchParam(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}
