import type { PurchaseOrder, PurchaseOrderItem, InvoiceStatus, InvoiceSource } from "@/types/models";

/**
 * All derivation/validation logic for the invoice-upload UI lives here, kept
 * free of React so it can be unit tested directly (see
 * __tests__/invoice-state.test.ts).
 *
 * Source of truth for upload rules is backend-docs/invoices-api.md — the
 * purchase order must be APPROVED, SHIPPED, RECEIVED or COMPLETED, and the
 * file must be PDF/PNG/JPEG under 10 MB. The backend re-checks all of this
 * server-side (bytes, not declared Content-Type); this module only avoids a
 * doomed round trip, it is never the source of truth.
 */

export const INVOICE_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const INVOICE_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

/** For the <input accept> attribute — extensions too, since some browsers/OSes omit `file.type`. */
export const INVOICE_FILE_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

const INVOICE_ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return INVOICE_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * The purchase order statuses an invoice can be uploaded against. Uploading
 * against DRAFT, PENDING_APPROVAL or REJECTED is a 409 INVALID_STATE per
 * backend-docs/invoices-api.md.
 */
export function canUploadInvoice(po: Pick<PurchaseOrder, "status">): boolean {
  return (
    po.status === "APPROVED" ||
    po.status === "SHIPPED" ||
    po.status === "RECEIVED" ||
    po.status === "COMPLETED"
  );
}

/**
 * The Invoice section on /requisitions/[id] renders once the PO can be
 * invoiced — i.e. the same status set as `canUploadInvoice`. Kept as a
 * separate named export (rather than reusing shipment's gate) because it
 * encodes the invoice API's precondition, not the shipment one, even though
 * the two currently happen to share a status set.
 */
export const shouldShowInvoiceSection = canUploadInvoice;

export type InvoiceFileValidationResult =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Validates a candidate file against backend-docs/invoices-api.md before
 * spending a round trip on it: must exist, be non-empty, be PDF/PNG/JPEG,
 * and be at most 10 MB. The backend sniffs actual bytes and will still 400 a
 * mistyped file (e.g. a .txt renamed .pdf) — this is a client-side courtesy
 * check, not a security boundary.
 */
export function validateInvoiceFile(file: File | null | undefined): InvoiceFileValidationResult {
  if (!file) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "This file is empty." };
  }
  if (file.size > INVOICE_MAX_FILE_BYTES) {
    return { ok: false, error: "File must be 10 MB or smaller." };
  }

  const mimeOk = (INVOICE_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  // Some browsers/OSes leave `file.type` blank for certain sources (e.g. a
  // dropped scan). Fall back to the extension rather than rejecting outright
  // — the backend's byte-sniffing check is the real gate either way.
  const extensionOk = file.type === "" && hasAcceptedExtension(file.name);
  if (!mimeOk && !extensionOk) {
    return { ok: false, error: "Only PDF, PNG and JPEG files are accepted." };
  }

  return { ok: true, file };
}

/**
 * Poll interval (ms) for GET /invoices/:id, or `false` to stop polling.
 * Per backend-docs/invoices-api.md: poll roughly every second through
 * extraction, matching, and approval. EXTRACTED and APPROVED are hand-off
 * points, not resting states — matching is queued at EXTRACTED, payment at
 * APPROVED — so both keep polling. EXCEPTION only clears when a human
 * resolves it (see api-docs/exceptions-api.md), which can take a while, so
 * it polls slower rather than at the same 1s cadence as an automatic
 * worker. PAID and FAILED are the real terminal states.
 *
 * A GENERATED invoice (backend-docs/documents-api.md) is created straight at
 * EXTRACTED and never enters matching — polling it under the same rule as an
 * UPLOADED invoice would poll forever, since it never leaves EXTRACTED. The
 * `source` param lets callers stop it immediately; it defaults to
 * "UPLOADED" so existing single-argument call sites keep their old
 * behaviour.
 */
export function getInvoicePollInterval(
  status: InvoiceStatus,
  source: InvoiceSource = "UPLOADED"
): number | false {
  if (source === "GENERATED") return false;

  switch (status) {
    case "UPLOADED":
    case "PROCESSING":
    case "EXTRACTED":
    case "MATCHING":
    case "APPROVED":
      return 1000;
    case "EXCEPTION":
      return 2000;
    default:
      return false;
  }
}

/** True while extraction itself is running — spinner + attempt counter. */
export function isInvoiceExtracting(status: InvoiceStatus): boolean {
  return status === "UPLOADED" || status === "PROCESSING";
}

/** True while any automatic worker (extraction or matching) is in flight. */
export function isInvoiceWorking(status: InvoiceStatus): boolean {
  return isInvoiceExtracting(status) || status === "MATCHING";
}

/** True for the terminal, unrecoverable extraction outcome. */
export function isInvoiceTerminalFailure(status: InvoiceStatus): boolean {
  return status === "FAILED";
}

export type InvoiceStatusTone = "info" | "progress" | "success" | "warning" | "error";

export interface InvoiceStatusMessage {
  title: string;
  tone: InvoiceStatusTone;
}

/**
 * Human-readable copy for each Invoice.status, per the Phase 8 spec. The
 * EXCEPTION message isn't in the spec verbatim — that status has no scripted
 * copy — but it's a reachable state (see api-docs/exceptions-api.md) and
 * must not render blank.
 */
export function getInvoiceStatusMessage(
  status: InvoiceStatus,
  failureReason?: string | null
): InvoiceStatusMessage {
  switch (status) {
    case "UPLOADED":
      return { title: "Invoice uploaded. Waiting for processing.", tone: "info" };
    case "PROCESSING":
      return { title: "AI is extracting invoice details.", tone: "progress" };
    case "EXTRACTED":
      return { title: "Extraction complete. Checking invoice against the PO.", tone: "progress" };
    case "MATCHING":
      return {
        title: "Checking invoice against purchase order and goods receipt.",
        tone: "progress",
      };
    case "APPROVED":
      return { title: "Invoice approved. Payment processing.", tone: "success" };
    case "PAID":
      return { title: "Payment completed.", tone: "success" };
    case "EXCEPTION":
      return {
        title: "Matching found a mismatch. Review the exception to continue.",
        tone: "warning",
      };
    case "FAILED":
      return {
        title: failureReason ?? "Extraction failed after 3 attempts.",
        tone: "error",
      };
  }
}

/** A generate-invoice dialog line's controlled form state, before validation. */
export interface GenerateInvoiceRawLine {
  purchaseOrderItemId: string;
  /** String while being edited; blank means "keep the ordered quantity". */
  quantity: string;
}

export interface GenerateInvoiceOverride {
  purchaseOrderItemId: string;
  quantity: number;
}

export type GenerateInvoiceValidationResult =
  | { ok: true; overrides: GenerateInvoiceOverride[] }
  | { ok: false; errors: Record<string, string> };

/**
 * Validates the quantity-override panel before POST
 * /purchase-orders/:id/generate-invoice (backend-docs/documents-api.md):
 * quantities must be non-negative integers. Only lines that differ from the
 * item's ordered quantity are sent — an unchanged or blank line bills the
 * full ordered quantity by omission, matching the documented default. This
 * is a client-side courtesy check; the backend re-validates and 400s a
 * negative, fractional or out-of-range quantity, or a repeated
 * purchaseOrderItemId.
 */
export function validateGenerateInvoiceOverrides(
  lines: GenerateInvoiceRawLine[],
  poItems: Pick<PurchaseOrderItem, "id" | "quantity">[]
): GenerateInvoiceValidationResult {
  const errors: Record<string, string> = {};
  const overrides: GenerateInvoiceOverride[] = [];

  for (const line of lines) {
    const poItem = poItems.find((item) => item.id === line.purchaseOrderItemId);
    const trimmed = line.quantity.trim();
    if (trimmed === "") continue;

    const parsed = Number(trimmed);
    // The API rejects a zero override (400 VALIDATION_ERROR): a zero-total line
    // compares equal against anything in three-way matching's UNIT_PRICE check,
    // so it would pass on no money at all. Every PO line is billed — leaving a
    // line off the invoice entirely is not supported.
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors[line.purchaseOrderItemId] = "Enter a whole number, 1 or greater.";
      continue;
    }
    if (poItem && parsed === poItem.quantity) continue;

    overrides.push({ purchaseOrderItemId: line.purchaseOrderItemId, quantity: parsed });
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, overrides };
}
