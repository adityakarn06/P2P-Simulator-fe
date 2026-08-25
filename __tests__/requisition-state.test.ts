/**
 * Requisition intake state-derivation tests
 *
 * Runner: node --test (no Vitest — matches package.json "test" script).
 * `@/` imports are resolved by __tests__/alias-loader.mjs, registered via
 * `--import` in the "test" script.
 *
 * Exercises the real module at lib/state/requisition-state.ts
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
  getWorkerActivity,
  getAwaitingAction,
  getWorkflowProgress,
} from "@/lib/state/requisition-state";
import { getInvoicePollInterval } from "@/lib/state/invoice-state";
import type {
  RequisitionStatus,
  InvoiceStatus,
  Requirement,
  Sourcing,
  PurchaseOrder,
} from "@/types/models";

const ALL_REQUISITION_STATUSES: RequisitionStatus[] = [
  "CREATED",
  "PROCESSING",
  "NEEDS_CLARIFICATION",
  "REQUIREMENTS_EXTRACTED",
  "SUPPLIER_SELECTED",
  "PO_CREATED",
  "FAILED",
];

const ALL_INVOICE_STATUSES: InvoiceStatus[] = [
  "UPLOADED",
  "PROCESSING",
  "EXTRACTED",
  "MATCHING",
  "APPROVED",
  "EXCEPTION",
  "PAID",
  "FAILED",
];

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

  test("matching/payment stay pending even once PO_CREATED", () => {
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    for (const id of ["matching", "payment"] as const) {
      assert.equal(stages.find((s) => s.id === id)!.status, "pending", id);
    }
  });

  test("matching stage: EXTRACTED/MATCHING -> active", () => {
    for (const status of ["EXTRACTED", "MATCHING"] as const) {
      const stages = deriveWorkflowStages(
        {
          status: "PO_CREATED",
          requirement: null,
          sourcing: null,
          purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
          failureReason: null,
          createdAt: CREATED_AT,
        },
        status
      );
      assert.equal(stages.find((s) => s.id === "matching")!.status, "active", status);
    }
  });

  test("matching stage: APPROVED/PAID -> completed", () => {
    for (const status of ["APPROVED", "PAID"] as const) {
      const stages = deriveWorkflowStages(
        {
          status: "PO_CREATED",
          requirement: null,
          sourcing: null,
          purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
          failureReason: null,
          createdAt: CREATED_AT,
        },
        status
      );
      assert.equal(stages.find((s) => s.id === "matching")!.status, "completed", status);
    }
  });

  test("matching stage: EXCEPTION -> failed, with a mismatch note", () => {
    const stages = deriveWorkflowStages(
      {
        status: "PO_CREATED",
        requirement: null,
        sourcing: null,
        purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
        failureReason: null,
        createdAt: CREATED_AT,
      },
      "EXCEPTION"
    );
    const matchingStage = stages.find((s) => s.id === "matching")!;
    assert.equal(matchingStage.status, "failed");
    assert.equal(matchingStage.note, "Mismatch found — review the exception.");
  });

  test("payment stage: APPROVED -> active, PAID -> completed, otherwise pending", () => {
    const base = {
      status: "PO_CREATED" as const,
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    };
    assert.equal(
      deriveWorkflowStages(base, "APPROVED").find((s) => s.id === "payment")!.status,
      "active"
    );
    assert.equal(
      deriveWorkflowStages(base, "PAID").find((s) => s.id === "payment")!.status,
      "completed"
    );
    for (const status of ["EXTRACTED", "MATCHING", "EXCEPTION", "FAILED"] as const) {
      assert.equal(
        deriveWorkflowStages(base, status).find((s) => s.id === "payment")!.status,
        "pending",
        status
      );
    }
  });

  test("invoice stage stays pending while the PO can't be invoiced yet", () => {
    const stages = deriveWorkflowStages({
      status: "PO_CREATED",
      requirement: null,
      sourcing: null,
      purchaseOrder: { id: "po_1", status: "PENDING_APPROVAL" } as PurchaseOrder,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages.find((s) => s.id === "invoice")!.status, "pending");
  });

  test("invoice stage stays pending (not active) while the invoices query hasn't resolved yet, even if the PO can already be invoiced", () => {
    // Regression: undefined means "don't know yet" (the invoices list query's
    // first fetch hasn't completed) and must not be treated the same as null
    // ("confirmed no invoice exists") — otherwise a PO that already has an
    // invoice in flight briefly flashes "active — upload the invoice".
    const stages = deriveWorkflowStages(
      {
        status: "PO_CREATED",
        requirement: null,
        sourcing: null,
        purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
        failureReason: null,
        createdAt: CREATED_AT,
      },
      undefined
    );
    assert.equal(stages.find((s) => s.id === "invoice")!.status, "pending");
  });

  test("invoice stage goes active once the PO can be invoiced and none has been uploaded", () => {
    const stages = deriveWorkflowStages(
      {
        status: "PO_CREATED",
        requirement: null,
        sourcing: null,
        purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
        failureReason: null,
        createdAt: CREATED_AT,
      },
      null
    );
    assert.equal(stages.find((s) => s.id === "invoice")!.status, "active");
  });

  test("invoice stage goes active as soon as the PO is APPROVED, not only once RECEIVED/COMPLETED", () => {
    // Regression: upload is legal from APPROVED/SHIPPED onward per
    // canUploadInvoice, which is wider than the shipment-completed check —
    // the invoice stage must not lag behind the section that's already
    // showing an Upload button.
    for (const status of ["APPROVED", "SHIPPED"] as const) {
      const stages = deriveWorkflowStages(
        {
          status: "PO_CREATED",
          requirement: null,
          sourcing: null,
          purchaseOrder: { id: "po_1", status } as PurchaseOrder,
          failureReason: null,
          createdAt: CREATED_AT,
        },
        null
      );
      assert.equal(stages.find((s) => s.id === "invoice")!.status, "active", status);
    }
  });

  test("invoice stage: UPLOADED/PROCESSING -> active", () => {
    for (const status of ["UPLOADED", "PROCESSING"] as const) {
      const stages = deriveWorkflowStages(
        {
          status: "PO_CREATED",
          requirement: null,
          sourcing: null,
          purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
          failureReason: null,
          createdAt: CREATED_AT,
        },
        status
      );
      assert.equal(stages.find((s) => s.id === "invoice")!.status, "active", status);
    }
  });

  test("invoice stage: EXTRACTED/MATCHING/APPROVED/EXCEPTION/PAID -> completed", () => {
    for (const status of ["EXTRACTED", "MATCHING", "APPROVED", "EXCEPTION", "PAID"] as const) {
      const stages = deriveWorkflowStages(
        {
          status: "PO_CREATED",
          requirement: null,
          sourcing: null,
          purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
          failureReason: null,
          createdAt: CREATED_AT,
        },
        status
      );
      assert.equal(stages.find((s) => s.id === "invoice")!.status, "completed", status);
    }
  });

  test("invoice stage: FAILED -> failed, with a re-upload note", () => {
    const stages = deriveWorkflowStages(
      {
        status: "PO_CREATED",
        requirement: null,
        sourcing: null,
        purchaseOrder: { id: "po_1", status: "COMPLETED" } as PurchaseOrder,
        failureReason: null,
        createdAt: CREATED_AT,
      },
      "FAILED"
    );
    const invoiceStage = stages.find((s) => s.id === "invoice")!;
    assert.equal(invoiceStage.status, "failed");
    assert.equal(invoiceStage.note, "Extraction failed — re-upload the document to retry.");
  });

  test("SUPPLIER_SELECTED, no PO yet: purchase-order stage active", () => {
    const stages = deriveWorkflowStages({
      status: "SUPPLIER_SELECTED",
      requirement: null,
      sourcing: { decidedAt: "2026-08-24T00:00:00.000Z" } as Sourcing,
      purchaseOrder: null,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    assert.equal(stages.find((s) => s.id === "purchase-order")!.status, "active");
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

  test("FAILED: the failed stage carries no stale activity caption", () => {
    const stages = deriveWorkflowStages({
      status: "FAILED",
      requirement: REQUIREMENT,
      sourcing: SOURCING,
      purchaseOrder: makePo("APPROVED"),
      failureReason: "Delivery simulation failed.",
      createdAt: CREATED_AT,
    });
    const shipmentStage = stages.find((s) => s.id === "shipment")!;
    assert.equal(shipmentStage.status, "failed");
    assert.equal(shipmentStage.activity, null);
  });

  test("PO APPROVED with an invoice already extracting: both the awaiting and the worker stage carry their own caption", () => {
    const stages = deriveWorkflowStages(
      {
        status: "PO_CREATED",
        requirement: REQUIREMENT,
        sourcing: SOURCING,
        purchaseOrder: makePo("APPROVED"),
        failureReason: null,
        createdAt: CREATED_AT,
      },
      "PROCESSING"
    );
    const shipmentStage = stages.find((s) => s.id === "shipment")!;
    const invoiceStage = stages.find((s) => s.id === "invoice")!;
    assert.deepEqual(shipmentStage.activity, {
      label: "Awaiting delivery simulation",
      variant: "awaiting",
    });
    assert.deepEqual(invoiceStage.activity, {
      label: "Extracting invoice…",
      variant: "working",
    });
  });
});

const REQUIREMENT: Requirement = {
  productName: "wireless keyboard",
  quantity: 100,
  maxUnitPricePaise: 200000,
  currency: "INR",
  deliveryDeadlineDays: 7,
  deliveryLocation: null,
  specifications: {},
};

const SOURCING = { decidedAt: "2026-08-24T00:00:00.000Z" } as Sourcing;

function makePo(status: PurchaseOrder["status"]): PurchaseOrder {
  return { id: "po_1", status } as PurchaseOrder;
}

describe("getWorkerActivity", () => {
  test("CREATED/PROCESSING, no requirement yet: AI processing…", () => {
    for (const status of ["CREATED", "PROCESSING"] as const) {
      const result = getWorkerActivity({
        status,
        requirement: null,
        sourcing: null,
        purchaseOrder: null,
      });
      assert.deepEqual(result, { stageId: "requirements", label: "AI processing…" }, status);
    }
  });

  test("completion trap: status still PROCESSING but requirement is set -> Supplier discovery, not AI processing", () => {
    const result = getWorkerActivity({
      status: "PROCESSING",
      requirement: REQUIREMENT,
      sourcing: null,
      purchaseOrder: null,
    });
    assert.deepEqual(result, { stageId: "sourcing", label: "Supplier discovery…" });
  });

  test("REQUIREMENTS_EXTRACTED, no sourcing yet: Supplier discovery…", () => {
    const result = getWorkerActivity({
      status: "REQUIREMENTS_EXTRACTED",
      requirement: REQUIREMENT,
      sourcing: null,
      purchaseOrder: null,
    });
    assert.deepEqual(result, { stageId: "sourcing", label: "Supplier discovery…" });
  });

  test("sourcing decided but no PO yet (one-tick race): Generating PO…", () => {
    const result = getWorkerActivity({
      status: "REQUIREMENTS_EXTRACTED",
      requirement: REQUIREMENT,
      sourcing: SOURCING,
      purchaseOrder: null,
    });
    assert.deepEqual(result, { stageId: "purchase-order", label: "Generating PO…" });
  });

  test("SUPPLIER_SELECTED, no PO yet: Generating PO…", () => {
    const result = getWorkerActivity({
      status: "SUPPLIER_SELECTED",
      requirement: REQUIREMENT,
      sourcing: SOURCING,
      purchaseOrder: null,
    });
    assert.deepEqual(result, { stageId: "purchase-order", label: "Generating PO…" });
  });

  test("PO already present while still polling: nothing requisition-side running", () => {
    const result = getWorkerActivity({
      status: "SUPPLIER_SELECTED",
      requirement: REQUIREMENT,
      sourcing: SOURCING,
      purchaseOrder: makePo("PENDING_APPROVAL"),
    });
    assert.equal(result, null);
  });

  test("human-gated requisition statuses never animate, regardless of invoice status", () => {
    for (const status of ["NEEDS_CLARIFICATION", "PO_CREATED", "FAILED"] as const) {
      assert.equal(
        getWorkerActivity({
          status,
          requirement: REQUIREMENT,
          sourcing: SOURCING,
          purchaseOrder: null,
        }),
        null,
        status
      );
    }
  });

  test("invoice UPLOADED/PROCESSING: Extracting invoice…", () => {
    for (const status of ["UPLOADED", "PROCESSING"] as const) {
      const result = getWorkerActivity(
        { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("APPROVED") },
        status
      );
      assert.deepEqual(result, { stageId: "invoice", label: "Extracting invoice…" }, status);
    }
  });

  test("invoice EXTRACTED/MATCHING: Checking invoice…", () => {
    for (const status of ["EXTRACTED", "MATCHING"] as const) {
      const result = getWorkerActivity(
        { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("APPROVED") },
        status
      );
      assert.deepEqual(result, { stageId: "matching", label: "Checking invoice…" }, status);
    }
  });

  test("invoice APPROVED: Payment processing…", () => {
    const result = getWorkerActivity(
      { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("APPROVED") },
      "APPROVED"
    );
    assert.deepEqual(result, { stageId: "payment", label: "Payment processing…" });
  });

  test("invoice EXCEPTION: the poll-but-no-worker carve-out — null despite getInvoicePollInterval returning a number", () => {
    assert.equal(getInvoicePollInterval("EXCEPTION"), 2000);
    const result = getWorkerActivity(
      { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("APPROVED") },
      "EXCEPTION"
    );
    assert.equal(result, null);
  });

  test("invoice PAID/FAILED: terminal, null", () => {
    for (const status of ["PAID", "FAILED"] as const) {
      const result = getWorkerActivity(
        { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("COMPLETED") },
        status
      );
      assert.equal(result, null, status);
    }
  });

  test("invariant: null whenever getPollInterval(status) is false and there's no invoice", () => {
    for (const status of ALL_REQUISITION_STATUSES) {
      if (isPolling(status)) continue;
      assert.equal(
        getWorkerActivity({
          status,
          requirement: null,
          sourcing: null,
          purchaseOrder: null,
        }),
        null,
        status
      );
    }
  });

  test("invariant: null whenever getInvoicePollInterval(status) is false", () => {
    for (const status of ALL_INVOICE_STATUSES) {
      if (getInvoicePollInterval(status) !== false) continue;
      const result = getWorkerActivity(
        { status: "PO_CREATED", requirement: null, sourcing: null, purchaseOrder: makePo("COMPLETED") },
        status
      );
      assert.equal(result, null, status);
    }
  });
});

describe("getAwaitingAction", () => {
  test("NEEDS_CLARIFICATION, no PO: Awaiting your reply", () => {
    const result = getAwaitingAction({ status: "NEEDS_CLARIFICATION", purchaseOrder: null });
    assert.deepEqual(result, { stageId: "requirements", label: "Awaiting your reply" });
  });

  test("worker-driven requisition statuses with no PO: not awaiting anything", () => {
    for (const status of [
      "CREATED",
      "PROCESSING",
      "REQUIREMENTS_EXTRACTED",
      "SUPPLIER_SELECTED",
    ] as const) {
      assert.equal(getAwaitingAction({ status, purchaseOrder: null }), null, status);
    }
  });

  test("PO PENDING_APPROVAL: Awaiting your approval", () => {
    const result = getAwaitingAction({
      status: "PO_CREATED",
      purchaseOrder: makePo("PENDING_APPROVAL"),
    });
    assert.deepEqual(result, { stageId: "purchase-order", label: "Awaiting your approval" });
  });

  test("PO APPROVED/SHIPPED, no invoice yet: Awaiting delivery simulation", () => {
    for (const status of ["APPROVED", "SHIPPED"] as const) {
      const result = getAwaitingAction(
        { status: "PO_CREATED", purchaseOrder: makePo(status) },
        null
      );
      assert.deepEqual(
        result,
        { stageId: "shipment", label: "Awaiting delivery simulation" },
        status
      );
    }
  });

  test("PO APPROVED with an invoice already extracting: still Awaiting delivery simulation (coexists with a different worker stage)", () => {
    const req = { status: "PO_CREATED" as const, purchaseOrder: makePo("APPROVED") };
    const awaiting = getAwaitingAction(req, "PROCESSING");
    const working = getWorkerActivity(
      { ...req, requirement: null, sourcing: null },
      "PROCESSING"
    );
    assert.deepEqual(awaiting, { stageId: "shipment", label: "Awaiting delivery simulation" });
    assert.deepEqual(working, { stageId: "invoice", label: "Extracting invoice…" });
    assert.notEqual(awaiting!.stageId, working!.stageId);
  });

  test("PO RECEIVED/COMPLETED, invoices list resolved empty: Awaiting invoice upload", () => {
    for (const status of ["RECEIVED", "COMPLETED"] as const) {
      const result = getAwaitingAction(
        { status: "PO_CREATED", purchaseOrder: makePo(status) },
        null
      );
      assert.deepEqual(result, { stageId: "invoice", label: "Awaiting invoice upload" }, status);
    }
  });

  test("PO RECEIVED, invoices list not resolved yet (undefined): don't guess", () => {
    const result = getAwaitingAction(
      { status: "PO_CREATED", purchaseOrder: makePo("RECEIVED") },
      undefined
    );
    assert.equal(result, null);
  });

  test("invoice EXCEPTION: Awaiting your review, regardless of PO status", () => {
    for (const status of ["APPROVED", "RECEIVED"] as const) {
      const result = getAwaitingAction(
        { status: "PO_CREATED", purchaseOrder: makePo(status) },
        "EXCEPTION"
      );
      assert.deepEqual(result, { stageId: "matching", label: "Awaiting your review" }, status);
    }
  });

  test("invoice FAILED or PAID: null (has its own error/terminal UI, not an awaiting-you chip)", () => {
    assert.equal(
      getAwaitingAction({ status: "PO_CREATED", purchaseOrder: makePo("RECEIVED") }, "FAILED"),
      null
    );
    assert.equal(
      getAwaitingAction({ status: "PO_CREATED", purchaseOrder: makePo("COMPLETED") }, "PAID"),
      null
    );
  });

  test("PO REJECTED or DRAFT: null", () => {
    assert.equal(
      getAwaitingAction({ status: "FAILED", purchaseOrder: makePo("REJECTED") }),
      null
    );
    assert.equal(
      getAwaitingAction({ status: "PO_CREATED", purchaseOrder: makePo("DRAFT") }),
      null
    );
  });

  test("invariant: getWorkerActivity and getAwaitingAction never name the same stage for the same input", () => {
    const poStatuses = [
      undefined,
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "SHIPPED",
      "RECEIVED",
      "COMPLETED",
    ] as const;
    const invoiceStatuses = [undefined, null, ...ALL_INVOICE_STATUSES] as const;

    for (const reqStatus of ALL_REQUISITION_STATUSES) {
      for (const poStatus of poStatuses) {
        for (const invoiceStatus of invoiceStatuses) {
          const purchaseOrder = poStatus ? makePo(poStatus) : null;
          const working = getWorkerActivity(
            { status: reqStatus, requirement: REQUIREMENT, sourcing: SOURCING, purchaseOrder },
            invoiceStatus
          );
          const awaiting = getAwaitingAction({ status: reqStatus, purchaseOrder }, invoiceStatus);
          if (working && awaiting) {
            assert.notEqual(
              working.stageId,
              awaiting.stageId,
              `${reqStatus}/${poStatus}/${invoiceStatus}`
            );
          }
        }
      }
    }
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

describe("getWorkflowProgress", () => {
  test("counts completed vs. total stages and rounds the percentage", () => {
    const stages = deriveWorkflowStages({
      status: "NEEDS_CLARIFICATION",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: null,
      createdAt: CREATED_AT,
    });
    // Only "Request" is completed out of 9 stages.
    const progress = getWorkflowProgress(stages);
    assert.equal(progress.total, stages.length);
    assert.equal(progress.completed, 1);
    assert.equal(progress.percent, Math.round((1 / stages.length) * 100));
  });

  test("returns 0% for an empty stage list without dividing by zero", () => {
    assert.deepEqual(getWorkflowProgress([]), { completed: 0, total: 0, percent: 0 });
  });

  test("a failed stage does not count as completed", () => {
    const stages = deriveWorkflowStages({
      status: "FAILED",
      requirement: null,
      sourcing: null,
      purchaseOrder: null,
      failureReason: "Something broke",
      createdAt: CREATED_AT,
    });
    const progress = getWorkflowProgress(stages);
    const failedCount = stages.filter((s) => s.status === "failed").length;
    assert.equal(failedCount, 1);
    assert.equal(progress.completed, stages.filter((s) => s.status === "completed").length);
  });
});
