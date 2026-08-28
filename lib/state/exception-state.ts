import { z } from "zod";
import type {
  Exception,
  ExceptionMatchCheck,
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
