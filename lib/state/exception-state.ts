import { z } from "zod";
import { formatStatus } from "@/lib/formatters";
import type {
  Exception,
  ExceptionDecision,
  ExceptionMatchCheck,
  ExceptionSettlement,
  ExceptionStatus,
  ExceptionType,
} from "@/types/models";

/**
 * All derivation logic for the exceptions inbox lives here, kept free of
 * React so it can be unit tested directly (see
 * __tests__/exception-state.test.ts).
 *
 * Source of truth: backend-docs/exceptions-api.md.
 */

/**
 * Mirrors the backend contract for POST /exceptions/:id/resolve: `reason`
 * is required, 10–1000 characters — "this is a financial judgement, the
 * backend refuses a resolution with no real explanation."
 */
export const resolveReasonSchema = z
  .string()
  .trim()
  .min(10, "Give at least a short explanation (10 characters).")
  .max(1000, "Reason must be 1000 characters or fewer.");

/**
 * Refresh cadence for exception lists — backend-docs/exceptions-api.md calls
 * this "the primary read for 'what needs my attention'". No sockets, so
 * poll. Shared by the exceptions inbox (hooks/use-exception-list.ts) and the
 * per-invoice alert on /requisitions/[id]
 * (components/exceptions/requisition-exception-alert.tsx).
 */
export const EXCEPTION_POLL_MS = 10_000;

/**
 * True only while OPEN or UNDER_REVIEW. An exception's status is terminal
 * once it leaves either — resolving again is always a 409 INVALID_STATE,
 * never a replayed 200, so the resolve UI must be disabled rather than
 * relying on the server to reject a duplicate.
 */
export function isResolvable(status: ExceptionStatus): boolean {
  return status === "OPEN" || status === "UNDER_REVIEW";
}

/**
 * `PO_APPROVAL_REQUIRED` is the one exception type POST /exceptions/:id/resolve
 * refuses (409 INVALID_STATE) — resolving it there would close the exception
 * while leaving the order stuck in PENDING_APPROVAL with nothing open against
 * it. It is decided on the purchase order instead, via
 * POST /purchase-orders/:id/approve | /reject, which closes it as a side effect.
 */
export function isResolvableHere(type: ExceptionType): boolean {
  return type !== "PO_APPROVAL_REQUIRED";
}

/**
 * The only gate the resolve UI should use: the exception must be open *now*
 * and its type must be decidable through this endpoint. Deliberately reads the
 * current `status` rather than "have we seen a resolution" — per
 * backend-docs/exceptions-api.md an exception can be *reopened*
 * (RESOLVED → OPEN) if the same failure happens again, so a decided exception
 * must never be cached as permanently decided.
 */
export function canResolveException(
  exception: Pick<Exception, "status" | "type">
): boolean {
  return isResolvable(exception.status) && isResolvableHere(exception.type);
}

/**
 * Poll interval (ms) for a single exception, or `false` to stop.
 *
 * An open exception is polled because a worker can resolve or supersede it and
 * because a PO_APPROVAL_REQUIRED row closes itself when the order is decided
 * elsewhere. A *closed* one is polled too, more slowly: "terminal" applies to
 * deciding it, not to the row for all time — a re-drive that mismatches the
 * same way reopens it, and a stale RESOLVED badge would then be a lie.
 */
export function getExceptionPollInterval(status: ExceptionStatus): number {
  return isResolvable(status) ? EXCEPTION_POLL_MS : EXCEPTION_POLL_MS * 3;
}

/**
 * An extra clarifying line for exception types whose name reads narrower than
 * what actually raises them. Only `DUPLICATE_INVOICE` needs one today: besides
 * a repeated invoice number, the *payment gate* raises it when a different
 * invoice against the same purchase order has already been paid — that second
 * document passes every three-way check (its number is genuinely new) but is
 * refused settlement so the order can never be paid twice. Without this note
 * the screen tells the user their invoice number is a duplicate when it isn't.
 *
 * Returns null for every other type — the backend's own `description` is the
 * primary prose and must not be second-guessed here.
 */
export function getExceptionTypeNote(type: ExceptionType): string | null {
  if (type === "DUPLICATE_INVOICE") {
    return (
      "Raised either because this invoice number was already recorded, or because " +
      "another invoice against the same purchase order has already been paid — the " +
      "order cannot be settled twice."
    );
  }
  return null;
}

/**
 * The raw `MatchCheckResult` rows behind a matching-originated exception —
 * present only on `QUANTITY_MISMATCH` / `PRICE_MISMATCH` / etc. Per
 * backend-docs/exceptions-api.md, this is the *only* place check failures are
 * exposed; do not synthesise rows for exception types that lack them.
 */
export function getExceptionChecks(exception: Pick<Exception, "metadata">): ExceptionMatchCheck[] {
  return exception.metadata?.checks ?? [];
}

/**
 * The failing checks to render, preferring the top-level `failedChecks` that
 * `GET /exceptions/:id` returns — those carry a per-check `severity`, which
 * `metadata.checks` does not — and falling back to `metadata.checks` for a row
 * that came from the list endpoint and has no `failedChecks` at all.
 *
 * The fallback is deliberately on *absence*, not emptiness: `failedChecks: []`
 * is the detail endpoint stating there are none (a NO_SUPPLIER_FOUND row, say),
 * and quietly substituting `metadata.checks` there would resurrect rows the
 * backend just said do not apply.
 */
export function getExceptionFailedChecks(
  exception: Pick<Exception, "metadata" | "failedChecks">
): ExceptionMatchCheck[] {
  return exception.failedChecks ?? getExceptionChecks(exception);
}

/**
 * The invoice/PO settlement ledger, present only on a detail fetch and null for
 * an exception that is not about an invoice. `undefined` (list row) and `null`
 * (not an invoice) both mean "nothing to show", so both collapse to null here.
 */
export function getExceptionSettlement(
  exception: Pick<Exception, "settlement">
): ExceptionSettlement | null {
  return exception.settlement ?? null;
}

/** True when the exception blocks an Invoice — gates payment-status polling and the related-exceptions panel. */
export function isInvoiceException(exception: Pick<Exception, "entityType">): boolean {
  return exception.entityType === "Invoice";
}

/**
 * Link to the entity's own detail screen, when one exists. `Shipment`,
 * `GoodsReceipt` and `Exception` have no detail route today, so those (and
 * any future entity type) resolve to `null` rather than a dead link.
 */
export function getExceptionEntityHref(
  exception: Pick<Exception, "entityType" | "entityId">
): string | null {
  switch (exception.entityType) {
    case "Invoice":
      return `/invoices/${exception.entityId}`;
    case "PurchaseOrder":
      return `/purchase-orders/${exception.entityId}`;
    case "Requisition":
      return `/requisitions/${exception.entityId}`;
    default:
      return null;
  }
}

/**
 * Display string for a check's `variance`. The API doc doesn't specify a
 * unit (quantity count, paise, percentage all appear across check types), so
 * this only formats the raw signed number — no currency symbol.
 */
export function formatCheckVariance(variance: number): string {
  const formatted = new Intl.NumberFormat("en-IN").format(Math.abs(variance));
  if (variance > 0) return `+${formatted}`;
  if (variance < 0) return `-${formatted}`;
  return formatted;
}

// ── Partial approval ─────────────────────────────────────────────────────────

/**
 * The decisions the resolve UI may offer for this exception.
 *
 * `PARTIAL_APPROVE` is offered only when the backend has computed a
 * `suggestedAmountPaise`. That field is null in exactly the cases the payment
 * worker would refuse an amount anyway — nothing received yet, no extracted
 * invoice total, invoice already fully settled, purchase order already spent —
 * so offering the decision there would mean offering a payment that is going to
 * bounce. It is also unavailable without a settlement block at all, which is
 * every non-invoice exception.
 */
export function getAvailableDecisions(
  exception: Pick<Exception, "settlement">
): ExceptionDecision[] {
  const settlement = getExceptionSettlement(exception);
  const canPartial = settlement != null && settlement.suggestedAmountPaise != null;
  return canPartial
    ? ["APPROVE", "PARTIAL_APPROVE", "REJECT"]
    : ["APPROVE", "REJECT"];
}

/** True when the resolve UI should show the partial-approval option. */
export function canPartialApprove(exception: Pick<Exception, "settlement">): boolean {
  return getAvailableDecisions(exception).includes("PARTIAL_APPROVE");
}

/**
 * The ceiling a partial approval may not exceed: whatever the invoice still
 * owes *and* whatever commitment the purchase order has left, whichever binds
 * first. Both caps are enforced server-side before any money moves; this only
 * keeps the UI from proposing an amount that is certain to be refused.
 */
export function getMaxApprovableAmountPaise(settlement: ExceptionSettlement): number {
  return Math.max(
    0,
    Math.min(settlement.invoiceOutstandingPaise, settlement.purchaseOrderOutstandingPaise)
  );
}

export type ApprovedAmountResult =
  | { ok: true; paise: number }
  | { ok: false; error: string };

/**
 * Parses and validates the approved-amount field, which users type in **rupees**
 * while the API takes integer **paise**.
 *
 * Rupees are accepted to at most two decimal places and converted with a round,
 * not a truncation — `Math.round(rupees * 100)` on a value already constrained
 * to 2dp lands exactly on the intended paise and repairs binary-float dust like
 * 206169.60 → 20616959.999. Anything finer than a paisa is rejected outright
 * rather than silently rounded, because silently altering the figure on a
 * payment request is precisely the mistake this validation exists to prevent.
 */
export function parseApprovedAmount(
  raw: string,
  settlement: ExceptionSettlement
): ApprovedAmountResult {
  const trimmed = raw.trim().replace(/,/g, "");
  if (trimmed === "") {
    return { ok: false, error: "Enter the amount to approve." };
  }

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      ok: false,
      error: "Enter an amount in rupees, to at most two decimal places.",
    };
  }

  const paise = Math.round(Number(trimmed) * 100);
  if (!Number.isFinite(paise) || paise <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const max = getMaxApprovableAmountPaise(settlement);
  if (max <= 0) {
    return {
      ok: false,
      error: "Nothing is left to settle on this invoice or purchase order.",
    };
  }
  if (paise > max) {
    return {
      ok: false,
      error: `Amount exceeds what is still outstanding (${formatPaiseInput(max)}).`,
    };
  }

  return { ok: true, paise };
}

/**
 * Renders integer paise as the plain rupee string the amount input holds —
 * digits and at most one decimal point, no currency symbol or grouping, so the
 * value round-trips through `parseApprovedAmount` unchanged. Use the `Money`
 * component for anything the user only reads.
 */
export function formatPaiseInput(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Toast/banner copy for a completed resolution. `releasedForPayment` is false
 * whenever other exceptions are still open on the invoice, which is not a
 * failure and must not read like one.
 */
export function getResolutionMessage(
  decision: ExceptionDecision,
  releasedForPayment: boolean
): string {
  if (decision === "REJECT") return "Exception rejected.";
  if (!releasedForPayment) {
    return "Exception approved. The invoice has other open exceptions and is still blocked.";
  }
  return decision === "PARTIAL_APPROVE"
    ? "Partial payment approved. The invoice will settle to Partially Paid."
    : "Exception approved — payment released.";
}

/**
 * Display label for a decided exception's `resolution`.
 *
 * Deliberately tolerant of the value's spelling. backend-docs/exceptions-api.md
 * documents the *request* vocabulary (`APPROVE` / `PARTIAL_APPROVE` / `REJECT`),
 * but the stored `resolution` comes back in past tense on some rows — live data
 * carries `APPROVE`, `APPROVED` and `REJECTED` side by side, the past-tense ones
 * written by the purchase-order approval path rather than by
 * /exceptions/:id/resolve. A strict lookup renders an empty heading on exactly
 * the rows a reviewer is auditing, so both spellings map to the same label.
 *
 * PARTIAL_APPROVE never collapses into "Approved": the point of that decision is
 * that the invoice was *not* settled as billed.
 */
export function getResolutionLabel(resolution: string | null): string {
  switch (resolution) {
    case "PARTIAL_APPROVE":
    case "PARTIALLY_APPROVED":
      return "Partial payment approved";
    case "APPROVE":
    case "APPROVED":
      return "Approved";
    case "REJECT":
    case "REJECTED":
      return "Rejected";
    case null:
      return "Decided";
    default:
      // An unrecognised value is still a decision that was made — show it
      // rather than a blank heading or a wrong one.
      return formatStatus(resolution);
  }
}
