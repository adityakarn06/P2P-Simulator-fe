/**
 * Shipment / goods-receipt state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - shouldShowShipmentSection — keyed on purchase order status
 *   - isInTransit / isDelivered — keyed on shipment status
 *   - canSimulateDelivery — IN_TRANSIT + no existing receipt, any line count
 *   - validateReceiptForm — per backend-docs/receipts-api.md quantity rules (flat/single-line)
 *   - validateMultiLineReceiptForm / buildExplicitReceiptBody — explicit (multi-line) form
 *   - deriveReceiptRows — reads acceptedQuantity, never recomputes it
 *   - parseReceiptConflict — defensive parse of a 409 CONFLICT's details
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  shouldShowShipmentSection,
  isInTransit,
  isDelivered,
  canSimulateDelivery,
  validateReceiptForm,
  buildFlatReceiptBody,
  validateMultiLineReceiptForm,
  buildExplicitReceiptBody,
  deriveReceiptRows,
  parseReceiptConflict,
  isQuantityConflict,
} from "@/lib/state/shipment-state";
import { ApiError } from "@/types/api";
import type { PurchaseOrderStatus, ShipmentStatus, GoodsReceipt, PurchaseOrderItem } from "@/types/models";

const ALL_PO_STATUSES: PurchaseOrderStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SHIPPED",
  "RECEIVED",
  "COMPLETED",
];

const ALL_SHIPMENT_STATUSES: ShipmentStatus[] = ["CREATED", "IN_TRANSIT", "DELIVERED"];

describe("shouldShowShipmentSection", () => {
  test("true for APPROVED, SHIPPED, RECEIVED, COMPLETED only", () => {
    const expected = new Set(["APPROVED", "SHIPPED", "RECEIVED", "COMPLETED"]);
    for (const status of ALL_PO_STATUSES) {
      assert.equal(
        shouldShowShipmentSection({ status }),
        expected.has(status),
        `status ${status}`
      );
    }
  });
});

describe("isInTransit", () => {
  test("true only for IN_TRANSIT", () => {
    for (const status of ALL_SHIPMENT_STATUSES) {
      assert.equal(isInTransit({ status }), status === "IN_TRANSIT", `status ${status}`);
    }
  });
});

describe("isDelivered", () => {
  test("true only for DELIVERED", () => {
    for (const status of ALL_SHIPMENT_STATUSES) {
      assert.equal(isDelivered({ status }), status === "DELIVERED", `status ${status}`);
    }
  });
});

describe("canSimulateDelivery", () => {
  const base = { shipmentStatus: "IN_TRANSIT" as ShipmentStatus, hasGoodsReceipt: false, poItemCount: 1 };

  test("true when in transit, no receipt, single line", () => {
    assert.equal(canSimulateDelivery(base), true);
  });

  test("false when not in transit", () => {
    assert.equal(canSimulateDelivery({ ...base, shipmentStatus: "CREATED" }), false);
    assert.equal(canSimulateDelivery({ ...base, shipmentStatus: "DELIVERED" }), false);
  });

  test("false when a goods receipt already exists", () => {
    assert.equal(canSimulateDelivery({ ...base, hasGoodsReceipt: true }), false);
  });

  test("true for a multi-line purchase order (explicit form)", () => {
    assert.equal(canSimulateDelivery({ ...base, poItemCount: 2 }), true);
  });

  test("false when the purchase order has no lines", () => {
    assert.equal(canSimulateDelivery({ ...base, poItemCount: 0 }), false);
  });
});

describe("validateReceiptForm", () => {
  const ordered = 100;

  test("rejects receivedQuantity of 0", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "0", damagedQuantity: "0", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.receivedQuantity);
  });

  test("rejects a negative receivedQuantity", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "-5", damagedQuantity: "0", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
  });

  test("rejects a negative damagedQuantity", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "10", damagedQuantity: "-1", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.damagedQuantity);
  });

  test("rejects non-integer quantities", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "10.5", damagedQuantity: "0", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
  });

  test("rejects damagedQuantity greater than receivedQuantity", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "10", damagedQuantity: "11", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.damagedQuantity);
  });

  test("accepts damagedQuantity equal to receivedQuantity", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "10", damagedQuantity: "10", notes: "" },
      ordered
    );
    assert.equal(result.ok, true);
  });

  test("rejects receivedQuantity greater than ordered", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "101", damagedQuantity: "0", notes: "" },
      ordered
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.receivedQuantity);
  });

  test("accepts receivedQuantity equal to ordered", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "100", damagedQuantity: "0", notes: "" },
      ordered
    );
    assert.equal(result.ok, true);
  });

  test("defaults an empty damagedQuantity to 0", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "98", damagedQuantity: "", notes: "" },
      ordered
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.values.damagedQuantity, 0);
  });

  test("trims notes and omits when empty", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "98", damagedQuantity: "2", notes: "   " },
      ordered
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.values.notes, undefined);
  });

  test("trims non-empty notes", () => {
    const result = validateReceiptForm(
      { receivedQuantity: "98", damagedQuantity: "2", notes: "  crushed box  " },
      ordered
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.values.notes, "crushed box");
  });
});

describe("buildFlatReceiptBody", () => {
  test("omits notes when undefined", () => {
    const body = buildFlatReceiptBody("ship_1", { receivedQuantity: 98, damagedQuantity: 2 });
    assert.deepEqual(body, { shipmentId: "ship_1", receivedQuantity: 98, damagedQuantity: 2 });
  });

  test("includes notes when present", () => {
    const body = buildFlatReceiptBody("ship_1", {
      receivedQuantity: 98,
      damagedQuantity: 2,
      notes: "crushed box",
    });
    assert.deepEqual(body, {
      shipmentId: "ship_1",
      receivedQuantity: 98,
      damagedQuantity: 2,
      notes: "crushed box",
    });
  });
});

describe("validateMultiLineReceiptForm", () => {
  const poItems = [
    { id: "poi_1", quantity: 100 },
    { id: "poi_2", quantity: 50 },
  ];

  test("accepts a valid multi-line submission", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "98", damagedQuantity: "2" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "50", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.values.items.length, 2);
      assert.deepEqual(result.values.items[0], {
        purchaseOrderItemId: "poi_1",
        receivedQuantity: 98,
        damagedQuantity: 2,
      });
    }
  });

  test("rejects a line with damaged greater than received", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "10", damagedQuantity: "11" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors["items.0.damagedQuantity"]);
  });

  test("rejects a line with received greater than ordered", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "101", damagedQuantity: "0" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors["items.0.receivedQuantity"]);
  });

  test("rejects a submission where every line has zero received", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "0", damagedQuantity: "0" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.items);
  });

  test("defaults a blank damaged field to 0", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "100", damagedQuantity: "" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.values.items[0].damagedQuantity, 0);
  });

  test("rejects a line whose purchaseOrderItemId is not on the purchase order", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_unknown", receivedQuantity: "999999", damagedQuantity: "0" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors["items.0.purchaseOrderItemId"]);
  });

  test("accepts a partial delivery where only some lines have arrived", () => {
    const result = validateMultiLineReceiptForm(
      {
        items: [
          { purchaseOrderItemId: "poi_1", receivedQuantity: "100", damagedQuantity: "0" },
          { purchaseOrderItemId: "poi_2", receivedQuantity: "0", damagedQuantity: "0" },
        ],
        notes: "",
      },
      poItems
    );
    assert.equal(result.ok, true);
  });
});

describe("buildExplicitReceiptBody", () => {
  test("builds the items[] payload, omitting notes when undefined", () => {
    const body = buildExplicitReceiptBody("ship_1", {
      items: [
        { purchaseOrderItemId: "poi_1", receivedQuantity: 98, damagedQuantity: 2 },
        { purchaseOrderItemId: "poi_2", receivedQuantity: 0, damagedQuantity: 0 },
      ],
    });
    assert.deepEqual(body, {
      shipmentId: "ship_1",
      items: [
        { purchaseOrderItemId: "poi_1", receivedQuantity: 98, damagedQuantity: 2 },
        { purchaseOrderItemId: "poi_2", receivedQuantity: 0, damagedQuantity: 0 },
      ],
    });
  });

  test("includes notes when present", () => {
    const body = buildExplicitReceiptBody("ship_1", {
      items: [{ purchaseOrderItemId: "poi_1", receivedQuantity: 98, damagedQuantity: 2 }],
      notes: "crushed box",
    });
    assert.equal(body.notes, "crushed box");
  });
});

describe("deriveReceiptRows", () => {
  const poItems: PurchaseOrderItem[] = [
    {
      id: "poi_1",
      productId: "prod_kb",
      supplierProductId: "sp_kb",
      description: "Wireless Keyboard",
      quantity: 100,
      unitPricePaise: 182000,
      lineTotalPaise: 18200000,
    },
  ];

  const goodsReceipt: Pick<GoodsReceipt, "items"> = {
    items: [
      {
        id: "ri_1",
        purchaseOrderItemId: "poi_1",
        productId: "prod_kb",
        orderedQuantity: 100,
        receivedQuantity: 98,
        damagedQuantity: 2,
        acceptedQuantity: 96,
      },
    ],
  };

  test("reads acceptedQuantity from the receipt rather than computing it", () => {
    const rows = deriveReceiptRows(goodsReceipt, poItems);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].accepted, 96);
    assert.equal(rows[0].ordered, 100);
    assert.equal(rows[0].received, 98);
    assert.equal(rows[0].damaged, 2);
    assert.equal(rows[0].description, "Wireless Keyboard");
  });

  test("falls back to productId when the PO item is missing", () => {
    const rows = deriveReceiptRows(goodsReceipt, []);
    assert.equal(rows[0].description, "prod_kb");
  });
});

describe("parseReceiptConflict", () => {
  test("parses a well-formed details object", () => {
    const result = parseReceiptConflict({
      recorded: { receivedQuantity: 98, damagedQuantity: 2 },
      submitted: { receivedQuantity: 95, damagedQuantity: 5 },
    });
    assert.notEqual(result, null);
    assert.deepEqual(result?.recorded, { receivedQuantity: 98, damagedQuantity: 2 });
  });

  test("returns null for undefined details", () => {
    assert.equal(parseReceiptConflict(undefined), null);
  });

  test("returns null for a malformed object", () => {
    assert.equal(parseReceiptConflict({ foo: "bar" }), null);
  });

  test("returns null for a non-object", () => {
    assert.equal(parseReceiptConflict("oops"), null);
  });
});

describe("isQuantityConflict", () => {
  test("true only for a CONFLICT ApiError", () => {
    assert.equal(isQuantityConflict(new ApiError("x", "CONFLICT", undefined, 409)), true);
    assert.equal(isQuantityConflict(new ApiError("x", "INVALID_STATE", undefined, 409)), false);
    assert.equal(isQuantityConflict(new Error("x")), false);
  });
});
