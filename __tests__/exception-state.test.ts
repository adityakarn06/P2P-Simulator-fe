/**
 * Exception resolve-flow state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - resolveReasonSchema — 10–1000 chars, trimmed, per backend-docs/exceptions-api.md
 *   - isResolvable — true only for OPEN / UNDER_REVIEW
 *   - getExceptionChecks — reads metadata.checks, never synthesises rows
 *   - isInvoiceException — true only for entityType "Invoice"
 *   - getExceptionEntityHref — routes to the entity's detail screen, or null
 *   - formatCheckVariance — signed, localised, no invented unit
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveReasonSchema,
  isResolvable,
  getExceptionChecks,
  isInvoiceException,
  getExceptionEntityHref,
  formatCheckVariance,
} from "@/lib/state/exception-state";
import type { Exception } from "@/types/models";

/** Minimal valid Exception, overridable per test — mirrors makeFile in invoice-state.test.ts. */
function makeException(overrides: Partial<Exception> = {}): Exception {
  return {
    id: "exc_abc123",
    organizationId: "org_dev",
    type: "QUANTITY_MISMATCH",
    status: "OPEN",
    severity: "CRITICAL",
    entityType: "Invoice",
    entityId: "inv_abc123",
    title: "Three-way match failed: quantity mismatch",
    description: "INVOICED_QUANTITY: expected Wireless Keyboard: 96, got Wireless Keyboard: 100",
    metadata: {},
    resolution: null,
    resolutionReason: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: "2026-08-26T11:05:00.000Z",
    updatedAt: "2026-08-26T11:05:00.000Z",
    ...overrides,
  };
}

describe("resolveReasonSchema", () => {
  test("rejects a reason under 10 characters", () => {
    const result = resolveReasonSchema.safeParse("too short");
    assert.equal(result.success, false);
  });

  test("rejects a whitespace-only reason", () => {
    const result = resolveReasonSchema.safeParse("            ");
    assert.equal(result.success, false);
  });

  test("accepts exactly 10 characters", () => {
    const result = resolveReasonSchema.safeParse("1234567890");
    assert.equal(result.success, true);
  });

  test("rejects 1001 characters", () => {
    const result = resolveReasonSchema.safeParse("a".repeat(1001));
    assert.equal(result.success, false);
  });

  test("accepts exactly 1000 characters", () => {
    const result = resolveReasonSchema.safeParse("a".repeat(1000));
    assert.equal(result.success, true);
  });

  test("trims surrounding whitespace", () => {
    const result = resolveReasonSchema.safeParse("  Approving payment for arrived units.  ");
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data, "Approving payment for arrived units.");
    }
  });
});

describe("isResolvable", () => {
  test("true for OPEN", () => {
    assert.equal(isResolvable("OPEN"), true);
  });

  test("true for UNDER_REVIEW", () => {
    assert.equal(isResolvable("UNDER_REVIEW"), true);
  });

  test("false for RESOLVED", () => {
    assert.equal(isResolvable("RESOLVED"), false);
  });

  test("false for REJECTED", () => {
    assert.equal(isResolvable("REJECTED"), false);
  });
});

describe("getExceptionChecks", () => {
  test("returns metadata.checks when present", () => {
    const checks = [
      { checkType: "INVOICED_QUANTITY", expected: "96", actual: "100", variance: 4 },
    ];
    const exception = makeException({ metadata: { checks } });
    assert.deepEqual(getExceptionChecks(exception), checks);
  });

  test("returns an empty array when metadata has no checks", () => {
    const exception = makeException({ metadata: {} });
    assert.deepEqual(getExceptionChecks(exception), []);
  });

  test("does not synthesise checks for a non-matching exception type", () => {
    const exception = makeException({ type: "SUPPLIER_MISMATCH", metadata: {} });
    assert.deepEqual(getExceptionChecks(exception), []);
  });
});

describe("isInvoiceException", () => {
  test("true when entityType is Invoice", () => {
    assert.equal(isInvoiceException(makeException({ entityType: "Invoice" })), true);
  });

  test("false when entityType is Requisition", () => {
    assert.equal(isInvoiceException(makeException({ entityType: "Requisition" })), false);
  });

  test("false when entityType is PurchaseOrder", () => {
    assert.equal(isInvoiceException(makeException({ entityType: "PurchaseOrder" })), false);
  });
});

describe("getExceptionEntityHref", () => {
  test("links Invoice to /invoices/:id", () => {
    const exception = makeException({ entityType: "Invoice", entityId: "inv_1" });
    assert.equal(getExceptionEntityHref(exception), "/invoices/inv_1");
  });

  test("links PurchaseOrder to /purchase-orders/:id", () => {
    const exception = makeException({ entityType: "PurchaseOrder", entityId: "po_1" });
    assert.equal(getExceptionEntityHref(exception), "/purchase-orders/po_1");
  });

  test("links Requisition to /requisitions/:id", () => {
    const exception = makeException({ entityType: "Requisition", entityId: "req_1" });
    assert.equal(getExceptionEntityHref(exception), "/requisitions/req_1");
  });

  test("returns null for entity types with no detail route", () => {
    const exception = makeException({ entityType: "Shipment", entityId: "ship_1" });
    assert.equal(getExceptionEntityHref(exception), null);
  });

  test("returns null for Exception entityType", () => {
    const exception = makeException({ entityType: "Exception", entityId: "exc_1" });
    assert.equal(getExceptionEntityHref(exception), null);
  });
});

describe("formatCheckVariance", () => {
  test("formats a positive variance with a leading +", () => {
    assert.equal(formatCheckVariance(4), "+4");
  });

  test("formats a negative variance with a leading -", () => {
    assert.equal(formatCheckVariance(-4), "-4");
  });

  test("formats zero with no sign", () => {
    assert.equal(formatCheckVariance(0), "0");
  });

  test("localises large numbers", () => {
    assert.equal(formatCheckVariance(1000), "+1,000");
  });
});
