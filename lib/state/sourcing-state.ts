import type { Sourcing, SupplierCandidate } from "@/types/models";

/**
 * All derivation logic for the supplier discovery UI lives here, kept free
 * of React so it can be unit tested directly (see
 * __tests__/sourcing-state.test.ts).
 *
 * Source of truth: `sourcing` + `supplierCandidates` on GET /requisitions/:id
 * (see backend-docs/sourcing-api.md). Supplier discovery adds no endpoints
 * of its own — never call one.
 */

/** Fixed scoring weights (backend-docs/sourcing-api.md — "Rendering suggestions"). */
export const SCORE_WEIGHTS = {
  price: 30,
  delivery: 25,
  reliability: 20,
  rating: 15,
  stock: 10,
} as const;

/**
 * Splits candidates into eligible / ineligible groups, each sorted by rank.
 * Ineligible candidates carry real price/delivery/stock data but all-zero
 * `scores` — they were never scored, not scored at zero.
 */
export function splitCandidates(candidates: SupplierCandidate[]): {
  eligible: SupplierCandidate[];
  ineligible: SupplierCandidate[];
} {
  const sorted = [...candidates].sort((a, b) => a.rank - b.rank);
  return {
    eligible: sorted.filter((c) => c.eligible),
    ineligible: sorted.filter((c) => !c.eligible),
  };
}

/**
 * True when this candidate is the committed decision.
 * Keyed on `sourcing.selectedSupplier.id` — the documented source of truth —
 * never on `rank === 1` alone (sourcing may be null on FAILED even though a
 * rank-1 candidate exists in the rejected list).
 */
export function isSelected(
  candidate: Pick<SupplierCandidate, "supplierId">,
  sourcing: Pick<Sourcing, "selectedSupplier"> | null
): boolean {
  if (!sourcing) return false;
  return sourcing.selectedSupplier.id === candidate.supplierId;
}
