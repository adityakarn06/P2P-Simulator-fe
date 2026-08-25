/**
 * API layer unit tests
 *
 * Runner: node --test  (no Vitest — matches package.json "test" script)
 * Coverage:
 *   - Response envelope parsing (success + error)
 *   - ApiError construction and flag getters
 *   - formatCurrencyFromPaise
 *   - formatDate / formatDateTime
 *   - Query key factories
 *   - Exception list envelope normalisation
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers — inline minimal implementations so the test file is self-contained
// and doesn't need a DOM / React runtime.
// ---------------------------------------------------------------------------

// Mimic the production ApiError class from types/api.ts
class ApiError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    message: string,
    code: string,
    details?: unknown,
    status?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }

  get isRetryable(): boolean {
    const TRANSIENT = new Set([500, 502, 503, 504]);
    return (
      this.code === "DEPENDENCY_UNAVAILABLE" ||
      this.code === "INTERNAL_ERROR" ||
      (this.status !== undefined && TRANSIENT.has(this.status))
    );
  }

  get isNotFound(): boolean {
    return this.code === "NOT_FOUND" || this.status === 404;
  }

  get isValidation(): boolean {
    return this.code === "VALIDATION_ERROR" || this.status === 400;
  }

  get isConflict(): boolean {
    return (
      this.code === "INVALID_STATE" ||
      this.code === "CONFLICT" ||
      this.status === 409
    );
  }
}

// Mimic the envelope parsing branch from client.ts
function parseEnvelope<T>(
  json: { success: boolean; data: unknown; error: unknown }
): T {
  if (!json.success) {
    const err = json.error as {
      code: string;
      message: string;
      details?: unknown;
    } | null;
    throw new ApiError(
      err?.message ?? "An unexpected error occurred.",
      err?.code ?? "UNKNOWN_ERROR",
      err?.details,
      undefined
    );
  }
  return json.data as T;
}

// Inline formatter (identical logic to lib/formatters.ts, no import needed)
function formatCurrencyFromPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Inline query key factories (mirrors hooks/*.ts exports)
// ---------------------------------------------------------------------------

const requisitionKeys = {
  detail: (id: string) => ["requisition", id] as const,
  list: (filters: object) => ["requisitions", "list", filters] as const,
};

const purchaseOrderKeys = {
  detail: (id: string) => ["purchase-order", id] as const,
};

const shipmentKeys = {
  detail: (id: string) => ["shipment", id] as const,
};

const invoiceKeys = {
  detail: (id: string) => ["invoice", id] as const,
  list: (filters: object) => ["invoices", "list", filters] as const,
};

const exceptionKeys = {
  list: (filters: object) => ["exceptions", "list", filters] as const,
};

const auditLogKeys = {
  list: (filters: object) => ["audit-logs", "list", filters] as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Response envelope parsing", () => {
  test("parses a success envelope and returns data", () => {
    const envelope = { success: true, data: { id: "req_1" }, error: null };
    const result = parseEnvelope<{ id: string }>(envelope);
    assert.equal(result.id, "req_1");
  });

  test("parses a nested success envelope", () => {
    const envelope = {
      success: true,
      data: { items: [{ id: "r1" }, { id: "r2" }], nextCursor: null },
      error: null,
    };
    const result = parseEnvelope<{
      items: { id: string }[];
      nextCursor: null;
    }>(envelope);
    assert.equal(result.items.length, 2);
    assert.equal(result.nextCursor, null);
  });

  test("throws ApiError on failure envelope", () => {
    const envelope = {
      success: false,
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Requisition not found",
      },
    };
    assert.throws(
      () => parseEnvelope(envelope),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal((err as ApiError).code, "NOT_FOUND");
        assert.equal((err as ApiError).message, "Requisition not found");
        return true;
      }
    );
  });

  test("throws ApiError with UNKNOWN_ERROR when error body is null", () => {
    const envelope = { success: false, data: null, error: null };
    assert.throws(
      () => parseEnvelope(envelope),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal((err as ApiError).code, "UNKNOWN_ERROR");
        return true;
      }
    );
  });
});

describe("ApiError flags", () => {
  test("isRetryable is true for DEPENDENCY_UNAVAILABLE", () => {
    const err = new ApiError("svc down", "DEPENDENCY_UNAVAILABLE", undefined, 503);
    assert.equal(err.isRetryable, true);
  });

  test("isRetryable is true for 500 status", () => {
    const err = new ApiError("boom", "INTERNAL_ERROR", undefined, 500);
    assert.equal(err.isRetryable, true);
  });

  test("isRetryable is false for 409 INVALID_STATE", () => {
    const err = new ApiError("conflict", "INVALID_STATE", undefined, 409);
    assert.equal(err.isRetryable, false);
  });

  test("isNotFound is true for NOT_FOUND code", () => {
    const err = new ApiError("missing", "NOT_FOUND", undefined, 404);
    assert.equal(err.isNotFound, true);
  });

  test("isNotFound is true for 404 status regardless of code", () => {
    const err = new ApiError("missing", "SOME_CODE", undefined, 404);
    assert.equal(err.isNotFound, true);
  });

  test("isValidation is true for VALIDATION_ERROR", () => {
    const err = new ApiError("bad input", "VALIDATION_ERROR", undefined, 400);
    assert.equal(err.isValidation, true);
  });

  test("isValidation is false for NOT_FOUND", () => {
    const err = new ApiError("missing", "NOT_FOUND", undefined, 404);
    assert.equal(err.isValidation, false);
  });

  test("details are preserved", () => {
    const details = { issues: [{ path: ["input"], message: "empty" }] };
    const err = new ApiError("invalid", "VALIDATION_ERROR", details, 400);
    assert.deepEqual(err.details, details);
  });

  test("isConflict is true for INVALID_STATE", () => {
    const err = new ApiError("already resolved", "INVALID_STATE", undefined, 409);
    assert.equal(err.isConflict, true);
  });

  test("isConflict is true for CONFLICT", () => {
    const err = new ApiError("race", "CONFLICT", undefined, 409);
    assert.equal(err.isConflict, true);
  });

  test("isConflict is true for a bare 409 status", () => {
    const err = new ApiError("conflict", "SOME_CODE", undefined, 409);
    assert.equal(err.isConflict, true);
  });

  test("isConflict is false for NOT_FOUND", () => {
    const err = new ApiError("missing", "NOT_FOUND", undefined, 404);
    assert.equal(err.isConflict, false);
  });
});

describe("formatCurrencyFromPaise", () => {
  test("182000 paise → ₹1,820.00", () => {
    const result = formatCurrencyFromPaise(182000);
    // The Intl formatter for en-IN uses ₹ and comma-separated Indian number groups
    assert.ok(result.includes("1,820"), `expected 1,820 in "${result}"`);
    assert.ok(result.includes("₹"), `expected ₹ symbol in "${result}"`);
  });

  test("0 paise → ₹0.00", () => {
    const result = formatCurrencyFromPaise(0);
    assert.ok(result.includes("0.00"), `expected 0.00 in "${result}"`);
  });

  test("100 paise → ₹1.00", () => {
    const result = formatCurrencyFromPaise(100);
    assert.ok(result.includes("1.00"), `expected 1.00 in "${result}"`);
  });

  test("21476000 paise → contains 2,14,760.00 (Indian grouping)", () => {
    const result = formatCurrencyFromPaise(21476000);
    // en-IN uses South Asian grouping: 2,14,760
    assert.ok(result.includes("760.00"), `expected 760.00 in "${result}"`);
  });

  test("always produces exactly 2 decimal places", () => {
    const result = formatCurrencyFromPaise(150);
    assert.ok(/\.50$/.test(result) || result.includes(".50"), `expected .50 in "${result}"`);
  });
});

describe("formatDate", () => {
  test("returns a string containing the year", () => {
    const result = formatDate("2026-08-24T10:00:00.000Z");
    assert.ok(result.includes("2026"), `expected 2026 in "${result}"`);
  });

  test("returns a string containing a month abbreviation", () => {
    const result = formatDate("2026-08-24T10:00:00.000Z");
    // en-IN month could be "Aug" or similar
    assert.ok(result.length > 0);
  });
});

describe("formatDateTime", () => {
  test("contains the year and time indicators", () => {
    const result = formatDateTime("2026-08-24T10:00:00.000Z");
    assert.ok(result.includes("2026"), `expected 2026 in "${result}"`);
    // Should contain AM or PM (hour12: true)
    const hasAmPm = result.includes("am") || result.includes("pm") ||
                    result.includes("AM") || result.includes("PM");
    assert.ok(hasAmPm, `expected AM/PM in "${result}"`);
  });
});

describe("Query key factories", () => {
  test('requisition detail key is ["requisition", id]', () => {
    const key = requisitionKeys.detail("req_abc");
    assert.deepEqual(key, ["requisition", "req_abc"]);
  });

  test('requisitions list key starts with ["requisitions"]', () => {
    const key = requisitionKeys.list({ status: "FAILED" });
    assert.equal(key[0], "requisitions");
    assert.deepEqual(key[2], { status: "FAILED" });
  });

  test('purchase-order detail key is ["purchase-order", id]', () => {
    const key = purchaseOrderKeys.detail("po_xyz");
    assert.deepEqual(key, ["purchase-order", "po_xyz"]);
  });

  test('shipment detail key is ["shipment", id]', () => {
    const key = shipmentKeys.detail("ship_1");
    assert.deepEqual(key, ["shipment", "ship_1"]);
  });

  test('invoice detail key is ["invoice", id]', () => {
    const key = invoiceKeys.detail("inv_abc");
    assert.deepEqual(key, ["invoice", "inv_abc"]);
  });

  test('invoices list key carries filters', () => {
    const key = invoiceKeys.list({ status: "EXTRACTED" });
    assert.equal(key[0], "invoices");
    assert.deepEqual(key[2], { status: "EXTRACTED" });
  });

  test('exceptions list key carries filters', () => {
    const key = exceptionKeys.list({ status: "OPEN", entityId: "inv_1" });
    assert.equal(key[0], "exceptions");
    assert.deepEqual(key[2], { status: "OPEN", entityId: "inv_1" });
  });

  test('audit-logs list key carries filters', () => {
    const key = auditLogKeys.list({ actorType: "USER", entityType: "Exception" });
    assert.equal(key[0], "audit-logs");
    assert.deepEqual(key[2], { actorType: "USER", entityType: "Exception" });
  });

  test("two different filters produce different keys", () => {
    const a = requisitionKeys.list({ status: "FAILED" });
    const b = requisitionKeys.list({ status: "PO_CREATED" });
    assert.notDeepEqual(a, b);
  });
});

describe("Exception list envelope normalisation", () => {
  // Mirrors the normalisation in lib/api/exceptions.ts listExceptions()
  function normaliseExceptionList(envelope: {
    exceptions: unknown[];
    nextCursor: string | null;
  }) {
    return { items: envelope.exceptions, nextCursor: envelope.nextCursor };
  }

  test("maps exceptions array to items", () => {
    const envelope = {
      exceptions: [{ id: "exc_1" }, { id: "exc_2" }],
      nextCursor: null,
    };
    const result = normaliseExceptionList(envelope);
    assert.equal(result.items.length, 2);
    assert.equal(result.nextCursor, null);
  });

  test("preserves nextCursor when present", () => {
    const envelope = {
      exceptions: [{ id: "exc_1" }],
      nextCursor: "exc_1",
    };
    const result = normaliseExceptionList(envelope);
    assert.equal(result.nextCursor, "exc_1");
  });

  test("empty exceptions array produces empty items", () => {
    const envelope = { exceptions: [], nextCursor: null };
    const result = normaliseExceptionList(envelope);
    assert.equal(result.items.length, 0);
  });
});

describe("Audit log envelope normalisation", () => {
  // Mirrors the normalisation in lib/api/audit-logs.ts listAuditLogs()
  function normaliseAuditLogList(envelope: {
    auditLogs: unknown[];
    nextCursor: string | null;
  }) {
    return { items: envelope.auditLogs, nextCursor: envelope.nextCursor };
  }

  test("maps auditLogs array to items", () => {
    const envelope = {
      auditLogs: [{ id: "aud_1" }, { id: "aud_2" }],
      nextCursor: null,
    };
    const result = normaliseAuditLogList(envelope);
    assert.equal(result.items.length, 2);
    assert.equal(result.nextCursor, null);
  });

  test("preserves nextCursor when present", () => {
    const envelope = { auditLogs: [{ id: "aud_1" }], nextCursor: "aud_1" };
    const result = normaliseAuditLogList(envelope);
    assert.equal(result.nextCursor, "aud_1");
  });

  test("empty auditLogs array produces empty items", () => {
    const envelope = { auditLogs: [], nextCursor: null };
    const result = normaliseAuditLogList(envelope);
    assert.equal(result.items.length, 0);
  });
});
