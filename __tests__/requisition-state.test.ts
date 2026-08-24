/**
 * Requisition intake state-derivation tests
 *
 * Runner: node --test (no Vitest — matches package.json "test" script, no
 * path-alias resolution under --experimental-strip-types).
 *
 * Mirrors the pure logic in features/requisitions/lib/requisition-state.ts —
 * inlined here (same convention as __tests__/api-layer.test.ts) so this file
 * needs no `@/` imports.
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

type RequisitionStatus =
  | "CREATED"
  | "PROCESSING"
  | "NEEDS_CLARIFICATION"
  | "REQUIREMENTS_EXTRACTED"
  | "SUPPLIER_SELECTED"
  | "PO_CREATED"
  | "FAILED";

interface Requirement {
  productName: string;
  quantity: number;
  maxUnitPricePaise: number;
  currency: string;
  deliveryDeadlineDays: number;
  deliveryLocation: string | null;
  specifications: Record<string, unknown>;
}

interface RequisitionChatResult {
  status: "NEEDS_CLARIFICATION" | "PROCESSING" | "REQUIREMENTS_EXTRACTED";
  requisitionId: string;
  message: string;
  missingFields?: string[];
  conflicts?: string[];
  requirements?: Requirement | null;
}

// Mirror of features/requisitions/lib/requisition-state.ts isExtractionComplete
function isExtractionComplete(req: { requirement: Requirement | null }): boolean {
  return req.requirement != null;
}

// Mirror of the same function's usage against the raw chat-result payload
function isChatResultComplete(result: RequisitionChatResult): boolean {
  return result.requirements != null;
}

// Mirror of isComposerEnabled
function isComposerEnabled(req: {
  status: RequisitionStatus;
  requirement: Requirement | null;
}): boolean {
  if (isExtractionComplete(req)) return false;
  return req.status === "NEEDS_CLARIFICATION";
}

// Mirror of getPollInterval
function getPollInterval(status: RequisitionStatus): number | false {
  switch (status) {
    case "CREATED":
    case "PROCESSING":
      return 2000;
    case "REQUIREMENTS_EXTRACTED":
    case "SUPPLIER_SELECTED":
      return 4000;
    case "NEEDS_CLARIFICATION":
    case "PO_CREATED":
    case "FAILED":
      return false;
    default:
      return false;
  }
}

// Mirror of missingFieldLabel (inline formatStatus, identical to lib/formatters.ts)
function formatStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  productName: "Product",
  quantity: "Quantity",
  maxUnitPricePaise: "Maximum Unit Price",
  currency: "Currency",
  deliveryDays: "Delivery Deadline",
  location: "Location",
  specifications: "Specifications",
};

function missingFieldLabel(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? formatStatus(field);
}

// Mirror of deriveWorkflowStages
interface Stage {
  id: string;
  label: string;
  status: "completed" | "active" | "pending" | "failed";
  note?: string | null;
}

function deriveWorkflowStages(req: {
  status: RequisitionStatus;
  requirement: Requirement | null;
  sourcing: { decidedAt: string } | null;
  purchaseOrder: { id: string } | null;
  failureReason: string | null;
}): Stage[] {
  const stages: Stage[] = [
    { id: "request", label: "Request", status: "completed" },
    {
      id: "requirements",
      label: "Requirements",
      status:
        req.requirement != null
          ? "completed"
          : req.status === "FAILED"
            ? "pending"
            : "active",
    },
    {
      id: "sourcing",
      label: "Supplier Discovery",
      status:
        req.sourcing != null
          ? "completed"
          : req.status === "REQUIREMENTS_EXTRACTED"
            ? "active"
            : "pending",
    },
    {
      id: "purchase-order",
      label: "Purchase Order",
      status:
        req.purchaseOrder != null
          ? "completed"
          : req.status === "SUPPLIER_SELECTED"
            ? "active"
            : "pending",
    },
  ];

  if (req.status === "FAILED") {
    const firstIncomplete = stages.find((s) => s.status !== "completed");
    if (firstIncomplete) {
      firstIncomplete.status = "failed";
      firstIncomplete.note = req.failureReason ?? "This step failed.";
    }
  }

  return stages;
}

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
  test("CREATED polls fast", () => {
    assert.equal(getPollInterval("CREATED"), 2000);
  });
  test("PROCESSING polls fast", () => {
    assert.equal(getPollInterval("PROCESSING"), 2000);
  });
  test("NEEDS_CLARIFICATION does not poll — actionable", () => {
    assert.equal(getPollInterval("NEEDS_CLARIFICATION"), false);
  });
  test("REQUIREMENTS_EXTRACTED polls slower — sourcing running", () => {
    assert.equal(getPollInterval("REQUIREMENTS_EXTRACTED"), 4000);
  });
  test("SUPPLIER_SELECTED polls slower — PO generation running", () => {
    assert.equal(getPollInterval("SUPPLIER_SELECTED"), 4000);
  });
  test("PO_CREATED is terminal — no poll", () => {
    assert.equal(getPollInterval("PO_CREATED"), false);
  });
  test("FAILED is terminal — no poll", () => {
    assert.equal(getPollInterval("FAILED"), false);
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
    });
    assert.equal(stages[1].status, "completed");
    assert.equal(stages[2].status, "active");
  });

  test("PO_CREATED: all four stages completed", () => {
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
      sourcing: { decidedAt: "2026-08-24T00:00:00.000Z" },
      purchaseOrder: { id: "po_1" },
      failureReason: null,
    });
    for (const stage of stages) {
      assert.equal(stage.status, "completed", stage.id);
    }
  });

  test("FAILED: first incomplete stage marked failed with the failure reason as its note", () => {
    const stages = deriveWorkflowStages({
      status: "FAILED",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: "No eligible suppliers found.",
    });
    assert.equal(stages[0].status, "completed");
    assert.equal(stages[1].status, "failed");
    assert.equal(stages[1].note, "No eligible suppliers found.");
    assert.equal(stages[2].status, "pending");
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
