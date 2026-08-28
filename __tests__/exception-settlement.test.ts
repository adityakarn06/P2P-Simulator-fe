/**
 * Partial-approval / settlement state tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * The money parsing here is the highest-risk logic on the screen: it converts
 * what a human typed in rupees into the integer paise a payment request is made
 * of. Source of truth: backend-docs/exceptions-api.md.
 *
 * Coverage:
 *   - getExceptionFailedChecks — prefers the detail endpoint's `failedChecks`,
 *     falls back on absence but never on an explicit empty array
 *   - getExceptionSettlement — undefined (list row) and null (non-invoice) both null
 *   - getAvailableDecisions / canPartialApprove — PARTIAL_APPROVE only with a suggestion
 *   - getMaxApprovableAmountPaise — the tighter of the two caps
 *   - parseApprovedAmount — rupees → paise, rejects sub-paise precision and over-cap
 *   - formatPaiseInput — round-trips through parseApprovedAmount
 *   - getResolutionMessage — an approval leaving other exceptions open is not a failure
 *   - getResolutionLabel — tolerates the past-tense `resolution` values the API
 *     actually returns alongside the documented request vocabulary
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canPartialApprove,
  formatPaiseInput,
  getAvailableDecisions,
  getExceptionFailedChecks,
  getExceptionSettlement,
  getMaxApprovableAmountPaise,
  getResolutionLabel,
  getResolutionMessage,
  parseApprovedAmount,
} from "@/lib/state/exception-state";
import type { ExceptionSettlement } from "@/types/models";

function makeSettlement(overrides: Partial<ExceptionSettlement> = {}): ExceptionSettlement {
  return {
    purchaseOrderId: "po_1",
    poNumber: "PO-20260824-ABC123",
    currency: "INR",
    invoiceTotalPaise: 21476000,
    invoiceSettledPaise: 0,
    invoiceOutstandingPaise: 21476000,
    purchaseOrderTotalPaise: 21476000,
    purchaseOrderSettledPaise: 0,
    purchaseOrderOutstandingPaise: 21476000,
    fullySettled: false,
    suggestedAmountPaise: 20616960,
    ...overrides,
  };
}

describe("getExceptionFailedChecks", () => {
  const metadataCheck = { checkType: "SUBTOTAL", expected: "1", actual: "2", variance: 1 };
  const detailCheck = {
    checkType: "RECEIVED_QUANTITY",
    expected: "100",
    actual: "96",
    variance: -0.04,
    severity: "CRITICAL" as const,
  };

  test("prefers the detail endpoint's failedChecks, which carry severity", () => {
    const checks = getExceptionFailedChecks({
      metadata: { checks: [metadataCheck] },
      failedChecks: [detailCheck],
    });
    assert.deepEqual(checks, [detailCheck]);
  });

  test("falls back to metadata.checks for a list row with no failedChecks at all", () => {
    const checks = getExceptionFailedChecks({ metadata: { checks: [metadataCheck] } });
    assert.deepEqual(checks, [metadataCheck]);
  });

  test("an explicit empty failedChecks means none — it must not resurrect metadata.checks", () => {
    const checks = getExceptionFailedChecks({
      metadata: { checks: [metadataCheck] },
      failedChecks: [],
    });
    assert.deepEqual(checks, []);
  });

  test("no checks anywhere yields an empty array, never undefined", () => {
    assert.deepEqual(getExceptionFailedChecks({ metadata: {} }), []);
  });
});

describe("getExceptionSettlement", () => {
  test("null for a list row (undefined) and for a non-invoice exception (null)", () => {
    assert.equal(getExceptionSettlement({}), null);
    assert.equal(getExceptionSettlement({ settlement: null }), null);
  });

  test("passes the block through when present", () => {
    const settlement = makeSettlement();
    assert.equal(getExceptionSettlement({ settlement }), settlement);
  });
});

describe("getAvailableDecisions / canPartialApprove", () => {
  test("offers PARTIAL_APPROVE when the backend suggested an amount", () => {
    const exception = { settlement: makeSettlement() };
    assert.deepEqual(getAvailableDecisions(exception), [
      "APPROVE",
      "PARTIAL_APPROVE",
      "REJECT",
    ]);
    assert.equal(canPartialApprove(exception), true);
  });

  test("withholds it when suggestedAmountPaise is null — the worker would refuse anyway", () => {
    const exception = { settlement: makeSettlement({ suggestedAmountPaise: null }) };
    assert.deepEqual(getAvailableDecisions(exception), ["APPROVE", "REJECT"]);
    assert.equal(canPartialApprove(exception), false);
  });

  test("withholds it entirely for an exception with no settlement (e.g. NO_SUPPLIER_FOUND)", () => {
    assert.equal(canPartialApprove({ settlement: null }), false);
    assert.equal(canPartialApprove({}), false);
  });
});

describe("getMaxApprovableAmountPaise", () => {
  test("is the tighter of the invoice and purchase order balances", () => {
    assert.equal(
      getMaxApprovableAmountPaise(
        makeSettlement({ invoiceOutstandingPaise: 500, purchaseOrderOutstandingPaise: 900 })
      ),
      500
    );
    assert.equal(
      getMaxApprovableAmountPaise(
        makeSettlement({ invoiceOutstandingPaise: 900, purchaseOrderOutstandingPaise: 500 })
      ),
      500
    );
  });

  test("never negative", () => {
    assert.equal(
      getMaxApprovableAmountPaise(
        makeSettlement({ invoiceOutstandingPaise: -100, purchaseOrderOutstandingPaise: 900 })
      ),
      0
    );
  });
});

describe("parseApprovedAmount", () => {
  const settlement = makeSettlement();

  test("converts rupees to integer paise", () => {
    assert.deepEqual(parseApprovedAmount("206169.60", settlement), {
      ok: true,
      paise: 20616960,
    });
    assert.deepEqual(parseApprovedAmount("1", settlement), { ok: true, paise: 100 });
  });

  test("rounds away binary-float dust rather than truncating a paisa off", () => {
    // 206169.60 * 100 is 20616959.999999996 in IEEE 754; a truncation here
    // would silently short the supplier by a paisa.
    const result = parseApprovedAmount("206169.60", settlement);
    assert.equal(result.ok && result.paise, 20616960);
  });

  test("accepts grouped input and surrounding whitespace", () => {
    assert.deepEqual(parseApprovedAmount(" 2,06,169.60 ", settlement), {
      ok: true,
      paise: 20616960,
    });
  });

  test("rejects a blank field", () => {
    assert.equal(parseApprovedAmount("", settlement).ok, false);
    assert.equal(parseApprovedAmount("   ", settlement).ok, false);
  });

  test("rejects sub-paise precision rather than silently altering the figure", () => {
    assert.equal(parseApprovedAmount("100.123", settlement).ok, false);
  });

  test("rejects non-numeric and negative input", () => {
    assert.equal(parseApprovedAmount("abc", settlement).ok, false);
    assert.equal(parseApprovedAmount("-100", settlement).ok, false);
    assert.equal(parseApprovedAmount("1e5", settlement).ok, false);
  });

  test("rejects zero — the API requires an amount greater than zero", () => {
    assert.equal(parseApprovedAmount("0", settlement).ok, false);
    assert.equal(parseApprovedAmount("0.00", settlement).ok, false);
  });

  test("rejects an amount above the tighter outstanding balance", () => {
    const capped = makeSettlement({
      invoiceOutstandingPaise: 10000,
      purchaseOrderOutstandingPaise: 5000,
    });
    assert.equal(parseApprovedAmount("60", capped).ok, false);
    assert.equal(parseApprovedAmount("50", capped).ok, true);
  });

  test("rejects anything when nothing is left to settle", () => {
    const spent = makeSettlement({
      invoiceOutstandingPaise: 0,
      purchaseOrderOutstandingPaise: 0,
    });
    assert.equal(parseApprovedAmount("1", spent).ok, false);
  });
});

describe("formatPaiseInput", () => {
  test("renders a plain rupee string with no symbol or grouping", () => {
    assert.equal(formatPaiseInput(20616960), "206169.60");
    assert.equal(formatPaiseInput(100), "1.00");
  });

  test("round-trips back through parseApprovedAmount unchanged", () => {
    const settlement = makeSettlement();
    const paise = settlement.suggestedAmountPaise as number;
    const parsed = parseApprovedAmount(formatPaiseInput(paise), settlement);
    assert.deepEqual(parsed, { ok: true, paise });
  });
});

describe("getResolutionMessage", () => {
  test("names the partial outcome rather than claiming the invoice is paid", () => {
    assert.match(getResolutionMessage("PARTIAL_APPROVE", true), /Partially Paid/);
  });

  test("an approval that left other exceptions open reads as blocked, not failed", () => {
    const message = getResolutionMessage("APPROVE", false);
    assert.match(message, /other open exceptions/);
    assert.doesNotMatch(message, /fail/i);
  });

  test("a full approval that released payment says so", () => {
    assert.match(getResolutionMessage("APPROVE", true), /payment released/);
  });

  test("a rejection is a rejection regardless of releasedForPayment", () => {
    assert.equal(getResolutionMessage("REJECT", false), "Exception rejected.");
  });
});

describe("getResolutionLabel", () => {
  test("handles the documented request vocabulary", () => {
    assert.equal(getResolutionLabel("APPROVE"), "Approved");
    assert.equal(getResolutionLabel("REJECT"), "Rejected");
    assert.equal(getResolutionLabel("PARTIAL_APPROVE"), "Partial payment approved");
  });

  test("also handles the past-tense values live rows actually carry", () => {
    // GET /exceptions returns APPROVE, APPROVED and REJECTED side by side; a
    // strict lookup would render a blank heading on the past-tense rows.
    assert.equal(getResolutionLabel("APPROVED"), "Approved");
    assert.equal(getResolutionLabel("REJECTED"), "Rejected");
  });

  test("never collapses a partial approval into a plain approval", () => {
    assert.notEqual(getResolutionLabel("PARTIAL_APPROVE"), "Approved");
  });

  test("falls back to a readable label rather than an empty heading", () => {
    assert.equal(getResolutionLabel(null), "Decided");
    assert.equal(getResolutionLabel("SOME_NEW_VERDICT"), "Some New Verdict");
  });
});
