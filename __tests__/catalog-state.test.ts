/**
 * Supplier/product catalog state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - getOnTimeRate / getInFullRate / getAcceptanceRate — null, never 0, for a
 *     supplier with no delivery history
 *   - getReliabilityDelta / formatReliabilityDelta — sub-point drift is "no change"
 *   - canFulfil — both the minimum order and the stock ceiling
 *   - getCheapestOffer — price first, then lead time, matching sourcing's order
 *   - getCategories — sorted, de-duplicated, nulls dropped
 *   - toSearchParam — a blank box omits `q`, which the API 400s
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canFulfil,
  formatRate,
  formatReliabilityDelta,
  getAcceptanceRate,
  getCategories,
  getCheapestOffer,
  getInFullRate,
  getOnTimeRate,
  getReliabilityDelta,
  toSearchParam,
} from "@/lib/state/catalog-state";

const delivered = {
  totalDeliveries: 4,
  onTimeDeliveries: 3,
  inFullDeliveries: 2,
  orderedUnits: 400,
  acceptedUnits: 396,
};

const brandNew = {
  totalDeliveries: 0,
  onTimeDeliveries: 0,
  inFullDeliveries: 0,
  orderedUnits: 0,
  acceptedUnits: 0,
};

describe("delivery rates", () => {
  test("computed from the OTIF counters", () => {
    assert.equal(getOnTimeRate(delivered), 0.75);
    assert.equal(getInFullRate(delivered), 0.5);
    assert.equal(getAcceptanceRate(delivered), 0.99);
  });

  test("null for a supplier that has never delivered — 0% would libel a new vendor", () => {
    assert.equal(getOnTimeRate(brandNew), null);
    assert.equal(getInFullRate(brandNew), null);
    assert.equal(getAcceptanceRate(brandNew), null);
  });
});

describe("formatRate", () => {
  test("renders a percentage, and an em dash for no data", () => {
    assert.equal(formatRate(0.75), "75%");
    assert.equal(formatRate(0), "0%");
    assert.equal(formatRate(null), "—");
  });
});

describe("getReliabilityDelta / formatReliabilityDelta", () => {
  test("signed drift against the onboarding baseline", () => {
    assert.equal(
      Math.round(getReliabilityDelta({ reliabilityScore: 0.92, baselineReliability: 0.9 }) * 100),
      2
    );
  });

  test("formats with a sign", () => {
    assert.equal(formatReliabilityDelta(0.02), "+2 pts");
    assert.equal(formatReliabilityDelta(-0.05), "-5 pts");
  });

  test("sub-point drift reads as no change rather than rounding to a misleading 0", () => {
    assert.equal(formatReliabilityDelta(0.001), "no change");
    assert.equal(formatReliabilityDelta(0), "no change");
    assert.equal(formatReliabilityDelta(-0.004), "no change");
  });
});

describe("canFulfil", () => {
  const offer = { stockQuantity: 500, minOrderQuantity: 10 };

  test("true within both bounds, inclusive", () => {
    assert.equal(canFulfil(offer, 10), true);
    assert.equal(canFulfil(offer, 500), true);
    assert.equal(canFulfil(offer, 100), true);
  });

  test("false below the minimum order or above stock", () => {
    assert.equal(canFulfil(offer, 9), false);
    assert.equal(canFulfil(offer, 501), false);
  });
});

describe("getCheapestOffer", () => {
  test("cheapest wins", () => {
    const offers = [
      { id: "a", unitPricePaise: 200000, deliveryDays: 2 },
      { id: "b", unitPricePaise: 182000, deliveryDays: 5 },
    ];
    assert.equal(getCheapestOffer(offers)?.id, "b");
  });

  test("a price tie breaks on the shorter lead time, matching sourcing's order", () => {
    const offers = [
      { id: "slow", unitPricePaise: 182000, deliveryDays: 9 },
      { id: "fast", unitPricePaise: 182000, deliveryDays: 3 },
    ];
    assert.equal(getCheapestOffer(offers)?.id, "fast");
  });

  test("null for an empty list", () => {
    assert.equal(getCheapestOffer([]), null);
  });
});

describe("getCategories", () => {
  test("sorted, de-duplicated, nulls dropped", () => {
    const products = [
      { category: "Peripherals" },
      { category: null },
      { category: "Accessories" },
      { category: "Peripherals" },
    ];
    assert.deepEqual(getCategories(products), ["Accessories", "Peripherals"]);
  });

  test("an all-null list yields no options rather than a null entry", () => {
    assert.deepEqual(getCategories([{ category: null }]), []);
  });
});

describe("toSearchParam", () => {
  test("trims, and omits `q` entirely when blank — an empty q is a 400", () => {
    assert.equal(toSearchParam("  keyboard "), "keyboard");
    assert.equal(toSearchParam(""), undefined);
    assert.equal(toSearchParam("   "), undefined);
  });
});
