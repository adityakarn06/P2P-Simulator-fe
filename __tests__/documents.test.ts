/**
 * Documents API pure-helper tests (backend-docs/documents-api.md).
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - parseContentDispositionFilename — plain and RFC 5987 extended forms
 *   - fallbackDocumentFilename — per-kind, per-mime-type fallback names
 *   - isPreviewableMimeType — pdf/image/unsupported routing for the viewer
 *   - getInvoicePollInterval(status, source) — a GENERATED invoice never polls
 *   - validateGenerateInvoiceOverrides — quantity-override validation
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseContentDispositionFilename,
  fallbackDocumentFilename,
  isPreviewableMimeType,
} from "@/lib/documents";
import {
  getInvoicePollInterval,
  validateGenerateInvoiceOverrides,
} from "@/lib/state/invoice-state";
import type { InvoiceStatus } from "@/types/models";

describe("parseContentDispositionFilename", () => {
  test("parses the plain filename form", () => {
    assert.equal(
      parseContentDispositionFilename('attachment; filename="purchase-order-PO-1.pdf"'),
      "purchase-order-PO-1.pdf"
    );
  });

  test("parses the plain form without quotes", () => {
    assert.equal(
      parseContentDispositionFilename("attachment; filename=invoice-1.pdf"),
      "invoice-1.pdf"
    );
  });

  test("prefers the RFC 5987 extended form when both are present", () => {
    assert.equal(
      parseContentDispositionFilename(
        "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''actual%20name.pdf"
      ),
      "actual name.pdf"
    );
  });

  test("returns null when the header is missing", () => {
    assert.equal(parseContentDispositionFilename(null), null);
  });

  test("returns null when neither form is present", () => {
    assert.equal(parseContentDispositionFilename("attachment"), null);
  });
});

describe("fallbackDocumentFilename", () => {
  test("names a purchase order document by its identifier", () => {
    assert.equal(
      fallbackDocumentFilename("purchase-order", "PO-20260824-ABC123", "application/pdf"),
      "purchase-order-PO-20260824-ABC123.pdf"
    );
  });

  test("names a goods receipt document by its identifier", () => {
    assert.equal(
      fallbackDocumentFilename("goods-receipt", "gr_1", "application/pdf"),
      "goods-receipt-gr_1.pdf"
    );
  });

  test("uses the mime type's extension for an invoice image", () => {
    assert.equal(
      fallbackDocumentFilename("invoice", "INV-2026-0042", "image/jpeg"),
      "invoice-INV-2026-0042.jpg"
    );
    assert.equal(
      fallbackDocumentFilename("invoice", "INV-2026-0042", "image/png"),
      "invoice-INV-2026-0042.png"
    );
  });

  test("defaults to pdf for an unrecognised mime type", () => {
    assert.equal(
      fallbackDocumentFilename("invoice", "inv_1", "application/octet-stream"),
      "invoice-inv_1.pdf"
    );
  });
});

describe("isPreviewableMimeType", () => {
  test("routes application/pdf to the pdf viewer", () => {
    assert.equal(isPreviewableMimeType("application/pdf"), "pdf");
  });

  test("routes image/png and image/jpeg to the image viewer", () => {
    assert.equal(isPreviewableMimeType("image/png"), "image");
    assert.equal(isPreviewableMimeType("image/jpeg"), "image");
  });

  test("ignores a charset suffix", () => {
    assert.equal(isPreviewableMimeType("application/pdf; charset=binary"), "pdf");
  });

  test("falls back to unsupported for anything else", () => {
    assert.equal(isPreviewableMimeType("application/octet-stream"), "unsupported");
  });
});

describe("getInvoicePollInterval with source", () => {
  test("a GENERATED invoice never polls, regardless of status", () => {
    const statuses: InvoiceStatus[] = [
      "UPLOADED",
      "PROCESSING",
      "EXTRACTED",
      "MATCHING",
      "APPROVED",
      "EXCEPTION",
      "PAID",
      "FAILED",
    ];
    for (const status of statuses) {
      assert.equal(getInvoicePollInterval(status, "GENERATED"), false, status);
    }
  });

  test("an UPLOADED invoice keeps its normal polling cadence", () => {
    assert.equal(getInvoicePollInterval("EXTRACTED", "UPLOADED"), 1000);
    assert.equal(getInvoicePollInterval("EXCEPTION", "UPLOADED"), 2000);
    assert.equal(getInvoicePollInterval("PAID", "UPLOADED"), false);
  });

  test("defaults to UPLOADED behavior when source is omitted", () => {
    assert.equal(getInvoicePollInterval("EXTRACTED"), 1000);
  });
});

describe("validateGenerateInvoiceOverrides", () => {
  const poItems = [
    { id: "poi_1", quantity: 100 },
    { id: "poi_2", quantity: 50 },
  ];

  test("blank lines produce no overrides", () => {
    const result = validateGenerateInvoiceOverrides(
      [
        { purchaseOrderItemId: "poi_1", quantity: "" },
        { purchaseOrderItemId: "poi_2", quantity: "" },
      ],
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.overrides, []);
  });

  test("a line matching the ordered quantity is omitted, not sent as an override", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "100" }],
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.overrides, []);
  });

  test("a differing quantity becomes an override", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "98" }],
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.overrides, [{ purchaseOrderItemId: "poi_1", quantity: 98 }]);
    }
  });

  test("over-billing (more than ordered) is allowed client-side — the backend flags the mismatch", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "150" }],
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.overrides, [{ purchaseOrderItemId: "poi_1", quantity: 150 }]);
    }
  });

  test("rejects a negative quantity", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "-5" }],
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.poi_1, /0 or greater/i);
  });

  test("rejects a fractional quantity", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "1.5" }],
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.poi_1);
  });

  test("rejects a non-numeric quantity", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "abc" }],
      poItems
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.poi_1);
  });

  test("accepts a zero quantity as a valid override", () => {
    const result = validateGenerateInvoiceOverrides(
      [{ purchaseOrderItemId: "poi_1", quantity: "0" }],
      poItems
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.overrides, [{ purchaseOrderItemId: "poi_1", quantity: 0 }]);
    }
  });
});
