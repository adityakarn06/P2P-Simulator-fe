/**
 * Settlement-ledger state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - isPaymentInFlight / getPaymentPollInterval — BLOCKED is a resting state,
 *     not a transient one, per backend-docs/payments-api.md
 *   - getPaymentBlockReason — reads the backend's own prose, never invents a cause
 *   - isHumanAuthorized — keyed off authorizingExceptionId, not `kind`
 *   - getSettlementPercent / hasShortfall — a missing invoice total is not a zero
 *   - toLedgerLines — invoice and PO balances stay separate
 *   - sumCompletedPaise — only COMPLETED money counts as moved
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_POLL_MS,
  getPaymentBlockReason,
  getPaymentKindLabel,
  getPaymentPollInterval,
  getSettlementPercent,
  hasShortfall,
  isHumanAuthorized,
  isPaymentInFlight,
  sumCompletedPaise,
  toLedgerLines,
} from "@/lib/state/payment-state";
import type { Payment, PaymentLedger } from "@/types/payments";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay_1",
    invoiceId: "inv_1",
    settlementKey: "auto",
    purchaseOrderId: "po_1",
    amountPaise: 21476000,
    currency: "INR",
    status: "COMPLETED",
    kind: "FULL",
    provider: "SIMULATED",
    providerReference: "SIM-1",
    blockedReason: null,
    failureReason: null,
    authorizedBy: null,
    authorizationReason: null,
    authorizingExceptionId: null,
    invoiceSettledPaise: 21476000,
    shortfallPaise: 0,
    processedAt: null,
    completedAt: null,
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    invoice: {
      invoiceNumber: "INV-2026-0042",
      status: "PAID",
      totalPaise: 21476000,
      supplier: { id: "sup_1", name: "TechSource Distributors" },
    },
    purchaseOrder: { poNumber: "PO-1", totalPaise: 21476000, currency: "INR" },
    ...overrides,
  };
}

describe("isPaymentInFlight", () => {
  test("true only while a worker still holds the tranche", () => {
    assert.equal(isPaymentInFlight("PENDING"), true);
    assert.equal(isPaymentInFlight("PROCESSING"), true);
    assert.equal(isPaymentInFlight("COMPLETED"), false);
    assert.equal(isPaymentInFlight("FAILED"), false);
    assert.equal(isPaymentInFlight("BLOCKED"), false);
  });
});

describe("getPaymentPollInterval", () => {
  test("polls in-flight tranches and stops on every resting state", () => {
    assert.equal(getPaymentPollInterval("PENDING"), PAYMENT_POLL_MS);
    assert.equal(getPaymentPollInterval("PROCESSING"), PAYMENT_POLL_MS);
    assert.equal(getPaymentPollInterval("COMPLETED"), false);
    assert.equal(getPaymentPollInterval("FAILED"), false);
  });

  test("BLOCKED does not poll — a refused settlement will not clear itself", () => {
    assert.equal(getPaymentPollInterval("BLOCKED"), false);
  });
});

describe("getPaymentBlockReason", () => {
  test("prefers the backend's own reason", () => {
    assert.equal(
      getPaymentBlockReason(
        makePayment({ status: "BLOCKED", blockedReason: "PO already settled." })
      ),
      "PO already settled."
    );
    assert.equal(
      getPaymentBlockReason(
        makePayment({ status: "FAILED", failureReason: "Provider timeout." })
      ),
      "Provider timeout."
    );
  });

  test("falls back to generic copy rather than rendering nothing", () => {
    const blocked = getPaymentBlockReason(makePayment({ status: "BLOCKED" }));
    assert.ok(blocked && blocked.length > 0);
  });

  test("null for a payment with nothing to explain", () => {
    assert.equal(getPaymentBlockReason(makePayment({ status: "COMPLETED" })), null);
    assert.equal(getPaymentBlockReason(makePayment({ status: "PENDING" })), null);
  });
});

describe("isHumanAuthorized", () => {
  test("reads authorizingExceptionId, not kind", () => {
    // A human-approved amount that happens to clear the invoice is still FULL,
    // so `kind` cannot be the signal.
    assert.equal(
      isHumanAuthorized(makePayment({ kind: "FULL", authorizingExceptionId: "exc_1" })),
      true
    );
    assert.equal(
      isHumanAuthorized(makePayment({ kind: "PARTIAL", authorizingExceptionId: null })),
      false
    );
  });
});

describe("getPaymentKindLabel", () => {
  test("distinguishes an approved tranche from an automatic one", () => {
    assert.equal(
      getPaymentKindLabel({ kind: "PARTIAL", authorizingExceptionId: "exc_1" }),
      "Partial settlement · approved"
    );
    assert.equal(
      getPaymentKindLabel({ kind: "FULL", authorizingExceptionId: null }),
      "Full settlement · automatic"
    );
  });
});

describe("getSettlementPercent", () => {
  test("is a share of the invoice total", () => {
    const payment = makePayment({
      invoiceSettledPaise: 10000,
      invoice: { invoiceNumber: null, status: "PARTIALLY_PAID", totalPaise: 40000, supplier: null },
    });
    assert.equal(getSettlementPercent(payment), 25);
  });

  test("caps at 100 rather than reporting an over-settlement", () => {
    const payment = makePayment({
      invoiceSettledPaise: 50000,
      invoice: { invoiceNumber: null, status: "PAID", totalPaise: 40000, supplier: null },
    });
    assert.equal(getSettlementPercent(payment), 100);
  });

  test("null — not zero — when the invoice total was never extracted", () => {
    const payment = makePayment({
      invoice: { invoiceNumber: null, status: "PAID", totalPaise: null, supplier: null },
    });
    assert.equal(getSettlementPercent(payment), null);
  });
});

describe("hasShortfall", () => {
  test("true only for a real, quantified gap", () => {
    assert.equal(hasShortfall(makePayment({ shortfallPaise: 859040 })), true);
  });

  test("false when settled in full", () => {
    assert.equal(hasShortfall(makePayment({ shortfallPaise: 0 })), false);
  });

  test("false when the total was never extracted — a 0 there is not 'paid in full'", () => {
    const payment = makePayment({
      shortfallPaise: 0,
      invoice: { invoiceNumber: null, status: "PAID", totalPaise: null, supplier: null },
    });
    assert.equal(hasShortfall(payment), false);
  });
});

describe("toLedgerLines", () => {
  const ledger: PaymentLedger = {
    poNumber: "PO-1",
    invoiceTotalPaise: 21476000,
    invoiceSettledPaise: 20616960,
    invoiceOutstandingPaise: 859040,
    purchaseOrderTotalPaise: 30000000,
    purchaseOrderSettledPaise: 20616960,
    purchaseOrderOutstandingPaise: 9383040,
    fullySettled: false,
  };

  test("keeps the invoice and purchase order balances separate", () => {
    const [invoice, po] = toLedgerLines(ledger);
    assert.equal(invoice.label, "Invoice");
    assert.equal(invoice.totalPaise, 21476000);
    assert.equal(invoice.outstandingPaise, 859040);
    assert.equal(po.label, "Purchase order");
    assert.equal(po.totalPaise, 30000000);
    assert.equal(po.outstandingPaise, 9383040);
  });
});

describe("sumCompletedPaise", () => {
  test("counts only money that actually moved", () => {
    const rows = [
      { status: "COMPLETED" as const, amountPaise: 1000 },
      { status: "PENDING" as const, amountPaise: 5000 },
      { status: "BLOCKED" as const, amountPaise: 9000 },
      { status: "COMPLETED" as const, amountPaise: 500 },
    ];
    assert.equal(sumCompletedPaise(rows), 1500);
  });

  test("an empty list is zero", () => {
    assert.equal(sumCompletedPaise([]), 0);
  });
});
