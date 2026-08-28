/**
 * Three-way match reconciliation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * The invariants that matter here are all about not overclaiming. The backend
 * exposes no read endpoint for a passing ThreeWayMatch, so this comparison is
 * the client's own — which makes it easy to state something the backend never
 * said. Specifically:
 *   - a missing document is "unavailable", never a mismatch
 *   - money is compared in integer paise
 *   - matchOutcome reads the invoice's real status, never the derived rows
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deriveThreeWayMatch, matchOutcome } from "@/lib/state/match-state";
import type {
  GoodsReceipt,
  Invoice,
  PurchaseOrder,
  PurchaseOrderItem,
} from "@/types/models";

function makePoItem(overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem {
  return {
    id: "poi_1",
    productId: "prod-kb",
    supplierProductId: "sp_1",
    description: "Wireless Keyboard",
    quantity: 100,
    unitPricePaise: 182000,
    lineTotalPaise: 18200000,
    ...overrides,
  };
}

function makePo(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "po_1",
    poNumber: "PO-1",
    status: "APPROVED",
    requisitionId: "req_1",
    supplierId: "sup_1",
    supplier: { id: "sup_1", name: "TechSource" },
    subtotalPaise: 18200000,
    taxPaise: 3276000,
    totalPaise: 21476000,
    taxRateBps: 1800,
    currency: "INR",
    expectedDeliveryDate: "2026-09-01T00:00:00.000Z",
    approvedAt: "2026-08-26T00:00:00.000Z",
    approvedBy: "user_dev",
    rejectedAt: null,
    rejectionReason: null,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    items: [makePoItem()],
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<GoodsReceipt> = {}): GoodsReceipt {
  return {
    id: "gr_1",
    purchaseOrderId: "po_1",
    shipmentId: "shp_1",
    status: "COMPLETED",
    receivedAt: "2026-08-28T00:00:00.000Z",
    receivedBy: "user_dev",
    notes: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    items: [
      {
        id: "gri_1",
        purchaseOrderItemId: "poi_1",
        productId: "prod-kb",
        orderedQuantity: 100,
        receivedQuantity: 100,
        damagedQuantity: 0,
        acceptedQuantity: 100,
      },
    ],
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    purchaseOrderId: "po_1",
    supplierId: "sup_1",
    status: "PAID",
    source: "UPLOADED",
    fileMimeType: "application/pdf",
    fileSizeBytes: 48213,
    invoiceNumber: "INV-1",
    invoiceDate: "2026-08-28T00:00:00.000Z",
    supplierNameRaw: "TechSource",
    poNumberRaw: "PO-1",
    subtotalPaise: 18200000,
    taxPaise: 3276000,
    totalPaise: 21476000,
    currency: "INR",
    extractedAt: "2026-08-28T00:00:00.000Z",
    extractionAttempts: 1,
    failureReason: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    items: [
      {
        id: "ii_1",
        lineNumber: 1,
        description: "Wireless Keyboard",
        quantity: 100,
        unitPricePaise: 182000,
        lineTotalPaise: 18200000,
        productId: null,
      },
    ],
    ...overrides,
  };
}

// ── Clean match ──────────────────────────────────────────────────────────────

describe("deriveThreeWayMatch — documents that agree", () => {
  test("every comparable row matches", () => {
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), makeInvoice());
    assert.equal(view.hasReceipt, true);
    assert.equal(view.allRowsMatch, true);
    assert.ok(view.lines.length === 1);
    assert.ok(view.totals.every((r) => r.status === "match"));
  });

  test("quantity is compared across all three documents", () => {
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), makeInvoice());
    const qty = view.lines[0].rows.find((r) => r.label === "Quantity")!;
    assert.deepEqual(
      [qty.ordered, qty.received, qty.invoiced],
      ["100", "100", "100"]
    );
    assert.equal(qty.status, "match");
  });

  test("the receipt column carries accepted, not received — damage is not billable", () => {
    const receipt = makeReceipt({
      items: [
        {
          id: "gri_1",
          purchaseOrderItemId: "poi_1",
          productId: "prod-kb",
          orderedQuantity: 100,
          receivedQuantity: 100,
          damagedQuantity: 4,
          acceptedQuantity: 96,
        },
      ],
    });
    const view = deriveThreeWayMatch(makePo(), receipt, makeInvoice());
    const qty = view.lines[0].rows.find((r) => r.label === "Quantity")!;
    assert.equal(qty.received, "96");
    assert.equal(qty.status, "mismatch", "96 accepted against 100 billed is a real discrepancy");
  });
});

// ── Missing documents are not failures ───────────────────────────────────────

describe("deriveThreeWayMatch — absent data", () => {
  test("no receipt yet degrades to a two-way view rather than reporting mismatches", () => {
    const view = deriveThreeWayMatch(makePo(), null, makeInvoice());
    assert.equal(view.hasReceipt, false);
    const qty = view.lines[0].rows.find((r) => r.label === "Quantity")!;
    assert.equal(qty.received, null);
    assert.equal(qty.status, "match", "PO and invoice still agree");
    assert.equal(view.allRowsMatch, true);
  });

  test("an unextracted invoice field is unavailable, never a mismatch", () => {
    const invoice = makeInvoice({ totalPaise: null, taxPaise: null, currency: null });
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), invoice);
    for (const key of ["total", "tax", "currency"]) {
      const row = view.totals.find((r) => r.key === key)!;
      assert.equal(row.status, "unavailable", `${key} has nothing to compare against`);
    }
  });

  test("a PO line the invoice never billed shows a null invoiced column", () => {
    const invoice = makeInvoice({ items: [] });
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), invoice);
    const qty = view.lines[0].rows.find((r) => r.label === "Quantity")!;
    assert.equal(qty.invoiced, null);
    const unitPrice = view.lines[0].rows.find((r) => r.label === "Unit price")!;
    assert.equal(unitPrice.status, "unavailable");
  });

  test("the goods receipt never carries money, so price rows leave it blank", () => {
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), makeInvoice());
    const unitPrice = view.lines[0].rows.find((r) => r.label === "Unit price")!;
    assert.equal(unitPrice.received, null);
    assert.equal(unitPrice.status, "match", "still comparable between PO and invoice");
  });
});

// ── Real mismatches ──────────────────────────────────────────────────────────

describe("deriveThreeWayMatch — discrepancies", () => {
  test("an over-billed quantity is a mismatch", () => {
    const invoice = makeInvoice({
      items: [
        {
          id: "ii_1",
          lineNumber: 1,
          description: "Wireless Keyboard",
          quantity: 120,
          unitPricePaise: 182000,
          lineTotalPaise: 21840000,
          productId: null,
        },
      ],
    });
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), invoice);
    const qty = view.lines[0].rows.find((r) => r.label === "Quantity")!;
    assert.equal(qty.status, "mismatch");
    assert.equal(view.allRowsMatch, false);
  });

  test("money is compared in integer paise, so a one-paise gap is caught", () => {
    const invoice = makeInvoice({ totalPaise: 21476001 });
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), invoice);
    const total = view.totals.find((r) => r.key === "total")!;
    assert.equal(total.status, "mismatch");
  });

  test("a differing currency is a mismatch", () => {
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), makeInvoice({ currency: "USD" }));
    assert.equal(view.totals.find((r) => r.key === "currency")!.status, "mismatch");
  });

  test("invoice lines are matched to PO lines by description, case-insensitively", () => {
    const invoice = makeInvoice({
      items: [
        {
          id: "ii_1",
          lineNumber: 1,
          description: "  wireless keyboard  ",
          quantity: 100,
          unitPricePaise: 182000,
          lineTotalPaise: 18200000,
          productId: null,
        },
      ],
    });
    const view = deriveThreeWayMatch(makePo(), makeReceipt(), invoice);
    assert.equal(view.lines[0].rows.find((r) => r.label === "Quantity")!.invoiced, "100");
  });
});

// ── The backend's verdict, not ours ──────────────────────────────────────────

describe("matchOutcome", () => {
  test("passed only for an approved or paid invoice with nothing open against it", () => {
    assert.equal(matchOutcome({ status: "PAID" }, []), "passed");
    assert.equal(matchOutcome({ status: "APPROVED" }, []), "passed");
  });

  test("an open exception overrides an otherwise clean status", () => {
    assert.equal(
      matchOutcome({ status: "PAID" }, [{ status: "OPEN" }]),
      "exception",
      "a reopened exception must not be hidden behind a PAID badge"
    );
    assert.equal(matchOutcome({ status: "APPROVED" }, [{ status: "UNDER_REVIEW" }]), "exception");
  });

  test("a decided exception does not disqualify a paid invoice", () => {
    assert.equal(matchOutcome({ status: "PAID" }, [{ status: "RESOLVED" }]), "passed");
  });

  test("in-flight statuses are pending, not a passed match", () => {
    for (const status of ["UPLOADED", "PROCESSING", "EXTRACTED", "MATCHING"] as const) {
      assert.equal(matchOutcome({ status }, []), "pending");
    }
  });

  test("EXCEPTION and FAILED are reported as themselves", () => {
    assert.equal(matchOutcome({ status: "EXCEPTION" }, []), "exception");
    assert.equal(matchOutcome({ status: "FAILED" }, []), "failed");
  });
});
