/**
 * Supplier discovery state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - splitCandidates — eligible/ineligible split, sorted by rank
 *   - isSelected — keyed on sourcing.selectedSupplier.id, never rank alone
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { splitCandidates, isSelected } from "@/features/sourcing/lib/sourcing-state";
import type { Sourcing, SupplierCandidate } from "@/types/models";

const ZERO_SCORES = { price: 0, delivery: 0, reliability: 0, rating: 0, stock: 0, total: 0 };

function candidate(overrides: Partial<SupplierCandidate>): SupplierCandidate {
  return {
    supplierId: "sup-1",
    supplierName: "Supplier 1",
    rank: 1,
    eligible: true,
    ineligibleReason: null,
    unitPricePaise: 100000,
    deliveryDays: 5,
    availableStock: 100,
    scores: { price: 100, delivery: 100, reliability: 100, rating: 100, stock: 100, total: 100 },
    ...overrides,
  };
}

describe("splitCandidates", () => {
  test("splits a mixed list and sorts each group by rank", () => {
    const winner = candidate({ supplierId: "sup-winner", rank: 1, eligible: true });
    const runnerUp = candidate({ supplierId: "sup-runner-up", rank: 2, eligible: true });
    const loser = candidate({
      supplierId: "sup-loser",
      rank: 3,
      eligible: false,
      ineligibleReason: "Stock 40 is below the required 100",
      scores: ZERO_SCORES,
    });

    // Deliberately out of order to exercise the sort.
    const { eligible, ineligible } = splitCandidates([loser, winner, runnerUp]);

    assert.deepEqual(
      eligible.map((c) => c.supplierId),
      ["sup-winner", "sup-runner-up"]
    );
    assert.deepEqual(
      ineligible.map((c) => c.supplierId),
      ["sup-loser"]
    );
  });

  test("an ineligible-only list yields an empty eligible group", () => {
    const only = candidate({
      supplierId: "sup-only",
      eligible: false,
      ineligibleReason: "No catalog product matches",
      scores: ZERO_SCORES,
    });
    const { eligible, ineligible } = splitCandidates([only]);
    assert.deepEqual(eligible, []);
    assert.equal(ineligible.length, 1);
  });

  test("an empty list yields two empty groups", () => {
    const { eligible, ineligible } = splitCandidates([]);
    assert.deepEqual(eligible, []);
    assert.deepEqual(ineligible, []);
  });
});

describe("isSelected", () => {
  const sourcing: Pick<Sourcing, "selectedSupplier"> = {
    selectedSupplier: { id: "sup-winner", name: "TechSource Distributors" },
  };

  test("true only for the candidate matching sourcing.selectedSupplier.id", () => {
    assert.equal(isSelected({ supplierId: "sup-winner" }, sourcing), true);
    assert.equal(isSelected({ supplierId: "sup-runner-up" }, sourcing), false);
  });

  test("false for every candidate when sourcing is null (e.g. FAILED)", () => {
    assert.equal(isSelected({ supplierId: "sup-winner" }, null), false);
  });
});
