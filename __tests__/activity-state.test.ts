/**
 * Activity-timeline state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - getAuditActionLabel — non-empty, sentence-case copy for every AuditAction
 *   - describeAuditLog — WORKFLOW_FAILED stage detail, EXCEPTION_RESOLVED
 *     decision-driven label, EXCEPTION_CREATED type detail, empty-metadata fallback
 *   - mergeAuditLogs — dedupe by id, newest-first with id as tiebreaker
 *   - collectActivityTargets — dedupe + inclusion per available id
 *   - getActivityPollInterval — polls on open work, stops on terminal states
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_ACTIONS,
  getAuditActionLabel,
  getAuditActorLabel,
  describeAuditLog,
  mergeAuditLogs,
  collectActivityTargets,
  getActivityPollInterval,
} from "@/lib/state/activity-state";
import type { AuditLog } from "@/types/models";

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "aud_1",
    organizationId: "org_dev",
    actorType: "SYSTEM",
    actorId: null,
    action: "PO_CREATED",
    entityType: "PurchaseOrder",
    entityId: "po_1",
    metadata: {},
    createdAt: "2026-08-25T10:00:00.000Z",
    ...overrides,
  };
}

describe("getAuditActionLabel", () => {
  test("returns non-empty, sentence-case copy for every AuditAction", () => {
    for (const action of AUDIT_ACTIONS) {
      const label = getAuditActionLabel(action);
      assert.ok(label.length > 0, action);
      // Sentence case: starts with an uppercase letter, not SCREAMING_SNAKE_CASE.
      assert.match(label, /^[A-Z][a-z]/, action);
    }
  });

  test("matches the spec's example phrasing", () => {
    assert.equal(getAuditActionLabel("REQUIREMENTS_EXTRACTED"), "Requirements extracted");
    assert.equal(getAuditActionLabel("SUPPLIERS_DISCOVERED"), "Supplier discovery completed");
    assert.equal(getAuditActionLabel("SUPPLIER_SELECTED"), "Supplier selected");
    assert.equal(getAuditActionLabel("PO_CREATED"), "Purchase order generated");
    assert.equal(getAuditActionLabel("PO_APPROVED"), "Purchase order approved");
    assert.equal(getAuditActionLabel("SHIPMENT_CREATED"), "Shipment created");
    assert.equal(getAuditActionLabel("GOODS_RECEIVED"), "Goods received");
    assert.equal(getAuditActionLabel("INVOICE_UPLOADED"), "Invoice uploaded");
    assert.equal(getAuditActionLabel("INVOICE_EXTRACTED"), "Invoice extracted");
    assert.equal(getAuditActionLabel("MATCH_COMPLETED"), "Three-way matching completed");
    assert.equal(getAuditActionLabel("PAYMENT_COMPLETED"), "Payment completed");
  });
});

describe("getAuditActorLabel", () => {
  test("maps every actor type", () => {
    assert.equal(getAuditActorLabel("SYSTEM"), "System");
    assert.equal(getAuditActorLabel("AI"), "AI");
    assert.equal(getAuditActorLabel("USER"), "User");
  });
});

describe("describeAuditLog", () => {
  test("WORKFLOW_FAILED surfaces metadata.stage as the detail", () => {
    const log = makeLog({
      action: "WORKFLOW_FAILED",
      entityType: "Requisition",
      metadata: { stage: "purchase-order" },
    });
    const { label, detail } = describeAuditLog(log);
    assert.equal(label, "Workflow failed");
    assert.equal(detail, "Stage: purchase-order");
  });

  test("EXCEPTION_RESOLVED with decision APPROVE reads 'Exception approved'", () => {
    const log = makeLog({
      action: "EXCEPTION_RESOLVED",
      entityType: "Exception",
      metadata: { decision: "APPROVE" },
    });
    assert.equal(describeAuditLog(log).label, "Exception approved");
  });

  test("EXCEPTION_RESOLVED with decision REJECT reads 'Exception rejected'", () => {
    const log = makeLog({
      action: "EXCEPTION_RESOLVED",
      entityType: "Exception",
      metadata: { decision: "REJECT" },
    });
    assert.equal(describeAuditLog(log).label, "Exception rejected");
  });

  test("EXCEPTION_RESOLVED without a decision falls back to the generic label", () => {
    const log = makeLog({ action: "EXCEPTION_RESOLVED", entityType: "Exception", metadata: {} });
    assert.equal(describeAuditLog(log).label, "Exception resolved");
  });

  test("EXCEPTION_CREATED surfaces metadata.type as the detail", () => {
    const log = makeLog({
      action: "EXCEPTION_CREATED",
      entityType: "Exception",
      metadata: { type: "PRICE_MISMATCH" },
    });
    assert.equal(describeAuditLog(log).detail, "Type: PRICE_MISMATCH");
  });

  test("empty metadata yields a null detail", () => {
    const log = makeLog({ metadata: {} });
    assert.equal(describeAuditLog(log).detail, null);
  });

  test("unrecognised metadata falls back to a key/value summary", () => {
    const log = makeLog({ metadata: { providerReference: "sim_9f2c1" } });
    assert.equal(describeAuditLog(log).detail, "providerReference: sim_9f2c1");
  });
});

describe("mergeAuditLogs", () => {
  test("dedupes rows sharing an id across pages", () => {
    const shared = makeLog({ id: "aud_shared" });
    const merged = mergeAuditLogs([[shared], [shared]]);
    assert.equal(merged.length, 1);
  });

  test("sorts newest first by createdAt", () => {
    const older = makeLog({ id: "aud_a", createdAt: "2026-08-25T09:00:00.000Z" });
    const newer = makeLog({ id: "aud_b", createdAt: "2026-08-25T10:00:00.000Z" });
    const merged = mergeAuditLogs([[older, newer]]);
    assert.deepEqual(merged.map((l) => l.id), ["aud_b", "aud_a"]);
  });

  test("breaks a createdAt tie by id, descending", () => {
    const a = makeLog({ id: "aud_a", createdAt: "2026-08-25T10:00:00.000Z" });
    const b = makeLog({ id: "aud_b", createdAt: "2026-08-25T10:00:00.000Z" });
    const merged = mergeAuditLogs([[a, b]]);
    assert.deepEqual(merged.map((l) => l.id), ["aud_b", "aud_a"]);
  });
});

describe("collectActivityTargets", () => {
  test("includes only the requisition when nothing else exists yet", () => {
    const targets = collectActivityTargets({ requisitionId: "req_1" });
    assert.deepEqual(targets, [{ entityType: "Requisition", entityId: "req_1" }]);
  });

  test("adds every provided related entity", () => {
    const targets = collectActivityTargets({
      requisitionId: "req_1",
      purchaseOrderId: "po_1",
      shipmentIds: ["ship_1"],
      goodsReceiptIds: ["gr_1"],
      invoiceIds: ["inv_1"],
      exceptionIds: ["exc_1"],
    });
    assert.deepEqual(targets, [
      { entityType: "Requisition", entityId: "req_1" },
      { entityType: "PurchaseOrder", entityId: "po_1" },
      { entityType: "Shipment", entityId: "ship_1" },
      { entityType: "GoodsReceipt", entityId: "gr_1" },
      { entityType: "Invoice", entityId: "inv_1" },
      { entityType: "Exception", entityId: "exc_1" },
    ]);
  });

  test("dedupes repeated ids", () => {
    const targets = collectActivityTargets({
      requisitionId: "req_1",
      invoiceIds: ["inv_1", "inv_1"],
    });
    assert.equal(targets.filter((t) => t.entityId === "inv_1").length, 1);
  });
});

describe("getActivityPollInterval", () => {
  test("stops polling once the requisition failed", () => {
    assert.equal(getActivityPollInterval("FAILED", true), false);
  });

  test("stops polling once the downstream workflow reports no open work", () => {
    assert.equal(getActivityPollInterval("PO_CREATED", false), false);
  });

  test("polls while the workflow can still move", () => {
    assert.equal(getActivityPollInterval("PO_CREATED", true), 10_000);
    assert.equal(getActivityPollInterval("PROCESSING", true), 10_000);
  });
});
