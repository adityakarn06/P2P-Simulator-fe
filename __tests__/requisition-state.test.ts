/**
 * Requisition intake state-derivation tests
 *
 * Runner: node --test (no Vitest — matches package.json "test" script).
 * `@/` imports are resolved by __tests__/alias-loader.mjs, registered via
 * `--import` in the "test" script.
 *
 * Exercises the real module at features/requisitions/lib/requisition-state.ts
 * directly — no inlined copies. `isChatResultComplete` below is the one
 * intentional exception: it tests the raw POST-response payload shape
 * (`RequisitionChatResult`), not the module.
 *
 * Coverage:
 *   - isExtractionComplete / the completion trap (status stays "PROCESSING"
 *     on the completion turn — see backend-docs/requisitions-api.md)
 *   - getPollInterval for every RequisitionStatus
 *   - isComposerEnabled
 *   - deriveWorkflowStages (clarification / complete / PO_CREATED / FAILED)
 *   - missingFieldLabel fallback for unknown keys
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isExtractionComplete,
  isComposerEnabled,
  getPollInterval,
  isPolling,
  shouldShowSlowNotice,
  SLOW_POLL_NOTICE_MS,
  missingFieldLabel,
  deriveWorkflowStages,
  formatDeliveryDeadline,
} from "@/features/requisitions/lib/requisition-state";
import type {
  RequisitionStatus,
  Requirement,
  Sourcing,
  PurchaseOrder,
} from "@/types/models";

interface RequisitionChatResult {
  status: "NEEDS_CLARIFICATION" | "PROCESSING" | "REQUIREMENTS_EXTRACTED";
  requisitionId: string;
  message: string;
  missingFields?: string[];
  conflicts?: string[];
  requirements?: Requirement | null;
}

// Tests the raw POST-response payload shape, not the module — see header.
function isChatResultComplete(result: RequisitionChatResult): boolean {
  return result.requirements != null;
}

const CREATED_AT = "2026-08-17T00:00:00.000Z";

// ---------------------------------------------------------------------------

describe("isExtractionComplete / completion trap", () => {
  test("false when requirement is null", () => {
    assert.equal(isExtractionComplete({ requirement: null }), false);
  });

  test("true when requirement is a populated object", () => {
    const requirement: Requirement = {
      productName: "wireless keyboard",
      quantity: 100,
      maxUnitPricePaise: 200000,
      currency: "INR",
      deliveryDeadlineDays: 7,
      deliveryLocation: null,
      specifications: {},
    };
    assert.equal(isExtractionComplete({ requirement }), true);
  });

  test("completion turn: status stays PROCESSING but requirements is populated — must count as complete", () => {
    const result: RequisitionChatResult = {
      status: "PROCESSING",
      requisitionId: "req_1",
      message: "Got it.",
      requirements: {
        productName: "wireless keyboard",
        quantity: 100,
        maxUnitPricePaise: 200000,
        currency: "INR",
        deliveryDeadlineDays: 7,
        deliveryLocation: null,
        specifications: {},
      },
    };
    assert.equal(isChatResultComplete(result), true);
    assert.notEqual(result.status, "REQUIREMENTS_EXTRACTED");
  });

  test("202-accepted shape: status PROCESSING, no requirements — must NOT count as complete", () => {
    const result: RequisitionChatResult = {
      status: "PROCESSING",
      requisitionId: "req_1",
      message: "Still working on your request — check back in a moment.",
    };
    assert.equal(isChatResultComplete(result), false);
  });

  test("needs-clarification shape never counts as complete", () => {
    const result: RequisitionChatResult = {
      status: "NEEDS_CLARIFICATION",
      requisitionId: "req_1",
      message: "What's your budget?",
      missingFields: ["maxUnitPricePaise"],
      conflicts: [],
    };
    assert.equal(isChatResultComplete(result), false);
  });
});

describe("getPollInterval", () => {
  test("CREATED polls at ~1s", () => {
    assert.equal(getPollInterval("CREATED"), 1000);
  });
  test("PROCESSING polls at ~1s", () => {
    assert.equal(getPollInterval("PROCESSING"), 1000);
  });
  test("NEEDS_CLARIFICATION does not poll — actionable", () => {
    assert.equal(getPollInterval("NEEDS_CLARIFICATION"), false);
  });
  test("REQUIREMENTS_EXTRACTED polls at ~1s — sourcing running", () => {
    assert.equal(getPollInterval("REQUIREMENTS_EXTRACTED"), 1000);
  });
  test("SUPPLIER_SELECTED polls at ~1s — PO generation running", () => {
    assert.equal(getPollInterval("SUPPLIER_SELECTED"), 1000);
  });
  test("PO_CREATED is terminal — no poll", () => {
    assert.equal(getPollInterval("PO_CREATED"), false);
  });
  test("FAILED is terminal — no poll", () => {
    assert.equal(getPollInterval("FAILED"), false);
  });
});

describe("isPolling", () => {
  test("true for every working status", () => {
    const statuses: RequisitionStatus[] = [
      "CREATED",
      "PROCESSING",
      "REQUIREMENTS_EXTRACTED",
      "SUPPLIER_SELECTED",
    ];
    for (const status of statuses) {
      assert.equal(isPolling(status), true, status);
    }
  });

  test("false for every resting status", () => {
    const statuses: RequisitionStatus[] = ["NEEDS_CLARIFICATION", "PO_CREATED", "FAILED"];
    for (const status of statuses) {
      assert.equal(isPolling(status), false, status);
    }
  });
});

describe("shouldShowSlowNotice", () => {
  test("false just under the threshold", () => {
    assert.equal(
      shouldShowSlowNotice(0, SLOW_POLL_NOTICE_MS - 1, "PROCESSING"),
      false
    );
  });

  test("true at the threshold", () => {
    assert.equal(
      shouldShowSlowNotice(0, SLOW_POLL_NOTICE_MS, "PROCESSING"),
      true
    );
  });

  test("true well past the threshold", () => {
    assert.equal(
      shouldShowSlowNotice(0, SLOW_POLL_NOTICE_MS * 2, "REQUIREMENTS_EXTRACTED"),
      true
    );
  });

  test("false when the status isn't a polling status, no matter the elapsed time", () => {
    assert.equal(
      shouldShowSlowNotice(0, SLOW_POLL_NOTICE_MS * 2, "PO_CREATED"),
      false
    );
  });
});

describe("isComposerEnabled", () => {
  test("enabled only for NEEDS_CLARIFICATION", () => {
    assert.equal(
      isComposerEnabled({ status: "NEEDS_CLARIFICATION", requirement: null }),
      true
    );
  });

  test("disabled for CREATED / PROCESSING / REQUIREMENTS_EXTRACTED / SUPPLIER_SELECTED / PO_CREATED / FAILED", () => {
    const statuses: RequisitionStatus[] = [
      "CREATED",
      "PROCESSING",
      "REQUIREMENTS_EXTRACTED",
      "SUPPLIER_SELECTED",
      "PO_CREATED",
      "FAILED",
    ];
    for (const status of statuses) {
      assert.equal(isComposerEnabled({ status, requirement: null }), false, status);
    }
  });

  test("disabled once requirement is populated, even if status is stale as NEEDS_CLARIFICATION", () => {
    const requirement: Requirement = {
      productName: "wireless keyboard",
      quantity: 100,
      maxUnitPricePaise: 200000,
      currency: "INR",
      deliveryDeadlineDays: 7,
      deliveryLocation: null,
      specifications: {},
    };
    assert.equal(
      isComposerEnabled({ status: "NEEDS_CLARIFICATION", requirement }),
      false
    );
  });
});

describe("deriveWorkflowStages", () => {
  test("clarification state: only Request completed, Requirements active", () => {
    const stages = deriveWorkflowStages({
      status: "NEEDS_CLARIFICATION",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages[0].status, "completed");
    assert.equal(stages[1].status, "active");
    assert.equal(stages[2].status, "pending");
    assert.equal(stages[3].status, "pending");
  });

  test("requirements complete, sourcing running: Supplier Discovery active", () => {
    const requirement: Requirement = {
      productName: "wireless keyboard",
      quantity: 100,
      maxUnitPricePaise: 200000,
      currency: "INR",
      deliveryDeadlineDays: 7,
      deliveryLocation: null,
      specifications: {},
    };
    const stages = deriveWorkflowStages({
      status: "REQUIREMENTS_EXTRACTED",
      requirement,
      sourcing: null,
      purchaseOrder: null,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages[1].status, "completed");
    assert.equal(stages[2].status, "active");
  });

  test("PO_CREATED, PENDING_APPROVAL: first four stages completed, shipment/goods-receipt still pending", () => {
    const requirement: Requirement = {
      productName: "wireless keyboard",
      quantity: 100,
      maxUnitPricePaise: 200000,
      currency: "INR",
      deliveryDeadlineDays: 7,
      deliveryLocation: null,
      specifications: {},
    };
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement,
      sourcing: { decidedAt: "2026-08-24T00:00:00.000Z" } as Sourcing,
      purchaseOrder: { id: "po_1", status: "PENDING_APPROVAL" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    for (const stage of stages.slice(0, 4)) {
      assert.equal(stage.status, "completed", stage.id);
    }
    const shipment = stages.find((s) => s.id === "shipment")!;
    const goodsReceipt = stages.find((s) => s.id === "goods-receipt")!;
    assert.equal(shipment.status, "pending");
    assert.equal(goodsReceipt.status, "pending");
  });

  test("nine stages, in order", () => {
    const stages = deriveWorkflowStages({
      status: "CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.deepEqual(
      stages.map((s) => s.id),
      [
        "request",
        "requirements",
        "sourcing",
        "purchase-order",
        "shipment",
        "goods-receipt",
        "invoice",
        "matching",
        "payment",
      ]
    );
  });

  test("PO APPROVED: shipment active, goods-receipt still pending", () => {
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "APPROVED" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages.find((s) => s.id === "shipment")!.status, "active");
    assert.equal(stages.find((s) => s.id === "goods-receipt")!.status, "pending");
  });

  test("PO RECEIVED: shipment and goods-receipt both completed", () => {
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "RECEIVED" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages.find((s) => s.id === "shipment")!.status, "completed");
    assert.equal(stages.find((s) => s.id === "goods-receipt")!.status, "completed");
  });

  test("PO REJECTED: purchase-order stage fails with the rejection reason, independent of req.status", () => {
    const stages = deriveWorkflowStages({
      status: "FAILED",
      requirement: null,
      sourcing: null,
      purchaseOrder: {
        id: "po_1",
        status: "REJECTED",
        rejectionReason: "Budget exceeded.",
      } as PurchaseOrder,
      failureReason: "Purchase order rejected: Budget exceeded.",
      createdAt: CREATED_AT,
    });
    const poStage = stages.find((s) => s.id === "purchase-order")!;
    assert.equal(poStage.status, "failed");
    assert.equal(poStage.note, "Budget exceeded.");
  });

  test("invoice/matching/payment stay pending even once PO_CREATED", () => {
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    for (const id of ["invoice", "matching", "payment"] as const) {
      assert.equal(stages.find((s) => s.id === id)!.status, "pending", id);
    }
  });

  test("FAILED: first incomplete stage marked failed with the failure reason as its note", () => {
    const stages = deriveWorkflowStages({
      status: "FAILED",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: "No eligible suppliers found.",
      createdAt: CREATED_AT,
    });
    assert.equal(stages[0].status, "completed");
    assert.equal(stages[1].status, "failed");
    assert.equal(stages[1].note, "No eligible suppliers found.");
    assert.equal(stages[2].status, "pending");
  });
});

describe("formatDeliveryDeadline", () => {
  test("renders the deadline's calendar date regardless of client-local timezone", () => {
    // 2026-08-31T23:30:00Z + 1 day = 2026-09-01T23:30Z. In UTC-11 local time
    // that instant is still 2026-09-01 — a local-timezone format would wrongly
    // print "1 Sep" or "31 Aug" depending on the host's offset.
    assert.equal(formatDeliveryDeadline(1, "2026-08-31T23:30:00.000Z"), "1 day (by 01 Sept)");
  });

  test("pluralizes and computes the deadline date for a multi-day count", () => {
    assert.equal(formatDeliveryDeadline(7, "2026-08-17T00:00:00.000Z"), "7 days (by 24 Aug)");
  });
});

describe("missingFieldLabel", () => {
  test("maps known draft field names to human labels", () => {
    assert.equal(missingFieldLabel("maxUnitPricePaise"), "Maximum Unit Price");
    assert.equal(missingFieldLabel("deliveryDays"), "Delivery Deadline");
    assert.equal(missingFieldLabel("productName"), "Product");
  });

  test("falls back to formatStatus for an unknown field instead of throwing", () => {
    assert.equal(missingFieldLabel("some_unknown_field"), "Some Unknown Field");
  });
});
