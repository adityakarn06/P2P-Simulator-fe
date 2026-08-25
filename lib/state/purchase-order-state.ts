import { z } from "zod";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/models";
import type { PurchaseOrderListTab } from "@/store/purchase-order-store";

/**
 * All derivation logic for the purchase-order approval UI lives here, kept
 * free of React so it can be unit tested directly (see
 * __tests__/purchase-order-state.test.ts).
 *
 * Source of truth: `purchaseOrder` embedded on GET /requisitions/:id — see
 * backend-docs/purchase-orders-api.md. Status is never mutated client-side;
 * every flag here is derived from the server-provided status string.
 */

export const PO_APPROVAL_PROMPT = "Purchase order generated and waiting for approval.";

/** Mirrors backend-docs/purchase-orders-api.md: reason is required, 1–500 chars. */
export const rejectReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(500, "Reason must be 500 characters or fewer.");

export function validateRejectReason(
  raw: string
): { ok: true; reason: string } | { ok: false; message: string } {
  const result = rejectReasonSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? "Invalid reason." };
  }
  return { ok: true, reason: result.data };
}

/** True only while the backend will accept approve/reject. */
export function isAwaitingApproval(po: Pick<PurchaseOrder, "status">): boolean {
  return po.status === "PENDING_APPROVAL";
}

export function isApproved(po: Pick<PurchaseOrder, "status">): boolean {
  return po.status === "APPROVED";
}

export function isRejected(po: Pick<PurchaseOrder, "status">): boolean {
  return po.status === "REJECTED";
}

/** 1800 → "18%", 1250 → "12.5%". Integer basis-point arithmetic, never floats. */
export function formatTaxRate(taxRateBps: number): string {
  const percent = taxRateBps / 100;
  const rounded = Math.round(percent * 100) / 100;
  return `${rounded}%`;
}

/**
 * Buttons stay disabled from the click until the invalidated requisition
 * query lands the new status — the `*Succeeded` flags close the window
 * between `isPending → false` and the refetch, where a second click today
 * would fire a duplicate request.
 */
export function arePoActionsDisabled(flags: {
  approvePending: boolean;
  rejectPending: boolean;
  approveSucceeded: boolean;
  rejectSucceeded: boolean;
}): boolean {
  return (
    flags.approvePending ||
    flags.rejectPending ||
    flags.approveSucceeded ||
    flags.rejectSucceeded
  );
}

/**
 * Maps each /purchase-orders tab to the `status` query param it filters on
 * (undefined = no filter, i.e. "all"). DRAFT and COMPLETED have no tab of
 * their own — for the MVP every PO is created PENDING_APPROVAL regardless of
 * value (backend-docs/purchase-orders-api.md), so DRAFT is unreachable, and
 * both remain visible under "All".
 */
export const PO_LIST_TAB_STATUS: Record<PurchaseOrderListTab, PurchaseOrderStatus | undefined> = {
  all: undefined,
  pending: "PENDING_APPROVAL",
  approved: "APPROVED",
  shipped: "SHIPPED",
  received: "RECEIVED",
  rejected: "REJECTED",
};

const PO_LIST_POLL_MS = 3000;

/**
 * Poll interval (ms) for GET /purchase-orders, or `false` to stop polling.
 * Polls while any row in the current page is still worker-driven —
 * PENDING_APPROVAL (waiting on a human) or SHIPPED (waiting on delivery
 * simulation) — so an approval/rejection or delivery made elsewhere shows up
 * without a manual refresh. An empty page (e.g. a status tab with no rows
 * yet) has nothing to wait on, so it does not poll.
 */
export function getPurchaseOrderListPollInterval(
  items: Pick<PurchaseOrder, "status">[]
): number | false {
  const hasActiveRow = items.some(
    (item) => item.status === "PENDING_APPROVAL" || item.status === "SHIPPED"
  );
  return hasActiveRow ? PO_LIST_POLL_MS : false;
}
