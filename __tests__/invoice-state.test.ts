/**
 * Invoice upload state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * Coverage:
 *   - canUploadInvoice / shouldShowInvoiceSection — per backend-docs/invoices-api.md,
 *     upload is only legal against APPROVED, SHIPPED, RECEIVED or COMPLETED
 *   - validateInvoiceFile — existence, emptiness, mime allowlist, 10 MB cap
 *   - getInvoicePollInterval — 1s through UPLOADED/PROCESSING/EXTRACTED/MATCHING/APPROVED,
 *     2s at EXCEPTION, stopped at PAID/FAILED
 *   - isInvoiceExtracting / isInvoiceWorking — worker-in-flight predicates
 *   - getInvoiceStatusMessage — non-empty copy for every InvoiceStatus
 *   - formatFileSize
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canUploadInvoice,
  shouldShowInvoiceSection,
  validateInvoiceFile,
  getInvoicePollInterval,
  isInvoiceExtracting,
  isInvoiceWorking,
  isInvoiceTerminalFailure,
  getInvoiceStatusMessage,
  INVOICE_MAX_FILE_BYTES,
} from "@/lib/state/invoice-state";
import { formatFileSize } from "@/lib/formatters";
import type { PurchaseOrderStatus, InvoiceStatus } from "@/types/models";

function makeFile(bytes: number, type: string, name = "invoice.pdf"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("canUploadInvoice / shouldShowInvoiceSection", () => {
  test("true for APPROVED, SHIPPED, RECEIVED, COMPLETED", () => {
    const statuses: PurchaseOrderStatus[] = ["APPROVED", "SHIPPED", "RECEIVED", "COMPLETED"];
    for (const status of statuses) {
      assert.equal(canUploadInvoice({ status }), true, status);
      assert.equal(shouldShowInvoiceSection({ status }), true, status);
    }
  });

  test("false for DRAFT, PENDING_APPROVAL, REJECTED", () => {
    const statuses: PurchaseOrderStatus[] = ["DRAFT", "PENDING_APPROVAL", "REJECTED"];
    for (const status of statuses) {
      assert.equal(canUploadInvoice({ status }), false, status);
      assert.equal(shouldShowInvoiceSection({ status }), false, status);
    }
  });
});

describe("validateInvoiceFile", () => {
  test("rejects a missing file", () => {
    const result = validateInvoiceFile(null);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /choose a file/i);
  });

  test("rejects an empty file", () => {
    const result = validateInvoiceFile(makeFile(0, "application/pdf"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /empty/i);
  });

  test("rejects an unsupported mime type", () => {
    const result = validateInvoiceFile(makeFile(1024, "text/plain", "notes.txt"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /pdf, png and jpeg/i);
  });

  test("rejects a file over 10 MB", () => {
    const result = validateInvoiceFile(makeFile(INVOICE_MAX_FILE_BYTES + 1, "application/pdf"));
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /10 mb/i);
  });

  test("accepts a file exactly at the 10 MB cap", () => {
    const result = validateInvoiceFile(makeFile(INVOICE_MAX_FILE_BYTES, "application/pdf"));
    assert.equal(result.ok, true);
  });

  test("accepts PDF, PNG and JPEG", () => {
    for (const type of ["application/pdf", "image/png", "image/jpeg"]) {
      const result = validateInvoiceFile(makeFile(1024, type));
      assert.equal(result.ok, true, type);
    }
  });

  test("falls back to extension when the browser omits file.type", () => {
    const result = validateInvoiceFile(makeFile(1024, "", "scan.png"));
    assert.equal(result.ok, true);
  });

  test("rejects a blank-type file with an unrecognised extension", () => {
    const result = validateInvoiceFile(makeFile(1024, "", "scan.gif"));
    assert.equal(result.ok, false);
  });
});

describe("getInvoicePollInterval", () => {
  test("polls at ~1s through UPLOADED, PROCESSING, EXTRACTED, MATCHING, APPROVED", () => {
    const statuses: InvoiceStatus[] = [
      "UPLOADED",
      "PROCESSING",
      "EXTRACTED",
      "MATCHING",
      "APPROVED",
    ];
    for (const status of statuses) {
      assert.equal(getInvoicePollInterval(status), 1000, status);
    }
  });

  test("polls slower (2s) at EXCEPTION", () => {
    assert.equal(getInvoicePollInterval("EXCEPTION"), 2000);
  });

  test("stops polling for PAID, FAILED", () => {
    const statuses: InvoiceStatus[] = ["PAID", "FAILED"];
    for (const status of statuses) {
      assert.equal(getInvoicePollInterval(status), false, status);
    }
  });
});

describe("isInvoiceExtracting / isInvoiceWorking", () => {
  test("isInvoiceExtracting true only for UPLOADED, PROCESSING", () => {
    const truthy: InvoiceStatus[] = ["UPLOADED", "PROCESSING"];
    const falsy: InvoiceStatus[] = [
      "EXTRACTED",
      "MATCHING",
      "APPROVED",
      "EXCEPTION",
      "PAID",
      "FAILED",
    ];
    for (const status of truthy) assert.equal(isInvoiceExtracting(status), true, status);
    for (const status of falsy) assert.equal(isInvoiceExtracting(status), false, status);
  });

  test("isInvoiceWorking true for UPLOADED, PROCESSING, MATCHING", () => {
    const truthy: InvoiceStatus[] = ["UPLOADED", "PROCESSING", "MATCHING"];
    const falsy: InvoiceStatus[] = ["EXTRACTED", "APPROVED", "EXCEPTION", "PAID", "FAILED"];
    for (const status of truthy) assert.equal(isInvoiceWorking(status), true, status);
    for (const status of falsy) assert.equal(isInvoiceWorking(status), false, status);
  });
});

describe("isInvoiceTerminalFailure", () => {
  test("true only for FAILED", () => {
    assert.equal(isInvoiceTerminalFailure("FAILED"), true);
    assert.equal(isInvoiceTerminalFailure("EXTRACTED"), false);
    assert.equal(isInvoiceTerminalFailure("UPLOADED"), false);
  });
});

describe("getInvoiceStatusMessage", () => {
  test("returns non-empty copy for every InvoiceStatus", () => {
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
      const message = getInvoiceStatusMessage(status);
      assert.ok(message.title.length > 0, status);
      assert.ok(message.tone.length > 0, status);
    }
  });

  test("matches the Phase 8 spec copy for the automatic-worker states", () => {
    assert.equal(
      getInvoiceStatusMessage("UPLOADED").title,
      "Invoice uploaded. Waiting for processing."
    );
    assert.equal(getInvoiceStatusMessage("PROCESSING").title, "AI is extracting invoice details.");
    assert.equal(
      getInvoiceStatusMessage("MATCHING").title,
      "Checking invoice against purchase order and goods receipt."
    );
    assert.equal(
      getInvoiceStatusMessage("APPROVED").title,
      "Invoice approved. Payment processing."
    );
    assert.equal(getInvoiceStatusMessage("PAID").title, "Payment completed.");
  });

  test("FAILED prefers failureReason over the generic fallback", () => {
    assert.equal(
      getInvoiceStatusMessage("FAILED", "Document was unreadable.").title,
      "Document was unreadable."
    );
    assert.equal(
      getInvoiceStatusMessage("FAILED", null).title,
      "Extraction failed after 3 attempts."
    );
  });
});

describe("formatFileSize", () => {
  test("renders bytes under 1 KB as-is", () => {
    assert.equal(formatFileSize(512), "512 B");
  });

  test("renders KB with one decimal", () => {
    assert.equal(formatFileSize(48213), "47.1 KB");
  });

  test("renders MB with one decimal", () => {
    assert.equal(formatFileSize(10 * 1024 * 1024), "10.0 MB");
  });
});
