import { z } from "zod";
import type { Exception, ExceptionMatchCheck, ExceptionStatus } from "@/types/models";

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
