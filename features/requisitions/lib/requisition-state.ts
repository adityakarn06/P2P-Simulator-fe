import { formatStatus } from "@/lib/formatters";
import type { WorkflowStage } from "@/components/workflow-step";
import type { Requisition, RequisitionStatus } from "@/types/models";

/**
 * All derivation logic for the requisition intake screens lives here, kept
 * free of React so it can be unit tested directly (see
 * __tests__/requisition-state.test.ts).
 *
 * The single source of truth is GET /requisitions/:id (a `Requisition`).
 * Never branch on the POST response's `status` field — per
 * backend-docs/requisitions-api.md, the completion turn returns
 * `status: "PROCESSING"` (not `"REQUIREMENTS_EXTRACTED"`). Completion is
 * signalled by `requirements != null`.
 */

/** True once requirement extraction has produced a final `Requirement`. */
export function isExtractionComplete(req: Pick<Requisition, "requirement">): boolean {
  return req.requirement != null;
}

/**
 * True only while the requisition is actionable by the user via
 * POST /requisitions/:id/messages. The backend returns 409 INVALID_STATE
 * once status has moved past NEEDS_CLARIFICATION, so the composer must be
 * disabled everywhere else — including once requirements are complete.
 */
export function isComposerEnabled(
  req: Pick<Requisition, "status" | "requirement">
): boolean {
  if (isExtractionComplete(req)) return false;
  return req.status === "NEEDS_CLARIFICATION";
}

/**
 * Poll interval (ms) for GET /requisitions/:id, or `false` to stop polling.
 * Per backend-docs/README.md ("Polling, not sockets") and sourcing-api.md
 * ("Poll every ~1s"), every automatic/worker-driven transition — extraction,
 * sourcing, PO generation — is observed at ~1s. Stopped whenever the
 * requisition is actionable by the user or terminal.
 */
export function getPollInterval(status: RequisitionStatus): number | false {
  switch (status) {
    case "CREATED":
    case "PROCESSING":
    case "REQUIREMENTS_EXTRACTED":
    case "SUPPLIER_SELECTED":
      return 1000;
    case "NEEDS_CLARIFICATION":
    case "PO_CREATED":
    case "FAILED":
      return false;
    default:
      return false;
  }
}

/** True while GET /requisitions/:id is being polled for this status. */
export function isPolling(status: RequisitionStatus): boolean {
  return getPollInterval(status) !== false;
}

/** After this long polling the same status, show a "still working" notice instead of an error. */
export const SLOW_POLL_NOTICE_MS = 30_000;

/**
 * True once a polling status has been showing for >= SLOW_POLL_NOTICE_MS.
 * Never treat this as a failure — the backend job retries on its own; this
 * is purely a "haven't heard back yet" UI state (see backend-docs/README.md,
 * "give up after ~30s with a 'still working' state rather than an error").
 */
export function shouldShowSlowNotice(
  pollingSinceMs: number,
  nowMs: number,
  status: RequisitionStatus
): boolean {
  if (!isPolling(status)) return false;
  return nowMs - pollingSinceMs >= SLOW_POLL_NOTICE_MS;
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  productName: "Product",
  quantity: "Quantity",
  maxUnitPricePaise: "Maximum Unit Price",
  currency: "Currency",
  deliveryDays: "Delivery Deadline",
  location: "Location",
  specifications: "Specifications",
};

/** Maps a draft-requirement field name (as sent in `missingFields`) to a human label. */
export function missingFieldLabel(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? formatStatus(field);
}

/** Renders a deliveryDeadlineDays count as an absolute date string, e.g. "7 days (by 3 Sep)". */
export function formatDeliveryDeadline(days: number, fromIso: string): string {
  const from = new Date(fromIso);
  const deadline = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  const dateStr = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(deadline);
  const label = days === 1 ? "1 day" : `${days} days`;
  return `${label} (by ${dateStr})`;
}

type StageId =
  | "request"
  | "requirements"
  | "sourcing"
  | "purchase-order"
  | "shipment"
  | "goods-receipt"
  | "invoice"
  | "matching"
  | "payment";

/**
 * Maps real requisition state to WorkflowStage[] for WorkflowTimeline.
 * Only ever marks a stage "completed" from the presence of a real backend
 * object (`requirement`, `sourcing`, `purchaseOrder`) — never from the
 * status string alone.
 *
 * Shipment/goods-receipt derive from `purchaseOrder.status`, which IS
 * embedded on the requisition — the requisition's own `status` never
 * advances past PO_CREATED (backend-docs/README.md). Invoice/matching/
 * payment are tracked on the invoice, which this screen does not fetch, so
 * they stay "pending" rather than faking a completed stage.
 */
export function deriveWorkflowStages(
  req: Pick<
    Requisition,
    "status" | "requirement" | "sourcing" | "purchaseOrder" | "failureReason" | "createdAt"
  >
): WorkflowStage[] {
  const po = req.purchaseOrder;
  const poStatus = po?.status ?? null;
  const poRejected = poStatus === "REJECTED";

  const shipmentCompleted = poStatus === "RECEIVED" || poStatus === "COMPLETED";
  const shipmentActive = poStatus === "APPROVED" || poStatus === "SHIPPED";

  const stages: (WorkflowStage & { id: StageId })[] = [
    {
      id: "request",
      label: "Request",
      status: "completed",
      timestamp: req.createdAt,
    },
    {
      id: "requirements",
      label: "Requirements",
      status: req.requirement != null ? "completed" : "active",
    },
    {
      id: "sourcing",
      label: "Supplier Discovery",
      status: req.sourcing != null
        ? "completed"
        : req.status === "REQUIREMENTS_EXTRACTED"
          ? "active"
          : "pending",
    },
    {
      id: "purchase-order",
      label: "Purchase Order",
      status: poRejected
        ? "failed"
        : po != null
          ? "completed"
          : req.status === "SUPPLIER_SELECTED"
            ? "active"
            : "pending",
      note: poRejected ? po?.rejectionReason ?? "Purchase order rejected." : null,
    },
    {
      id: "shipment",
      label: "Shipment",
      status: shipmentCompleted ? "completed" : shipmentActive ? "active" : "pending",
    },
    {
      id: "goods-receipt",
      label: "Goods Receipt",
      status: shipmentCompleted ? "completed" : "pending",
    },
    {
      id: "invoice",
      label: "Invoice",
      status: "pending",
      note: "Tracked on the invoice, not shown here yet.",
    },
    {
      id: "matching",
      label: "Matching",
      status: "pending",
      note: "Tracked on the invoice, not shown here yet.",
    },
    {
      id: "payment",
      label: "Payment",
      status: "pending",
      note: "Tracked on the invoice, not shown here yet.",
    },
  ];

  if (req.status === "FAILED" && !poRejected) {
    const firstIncomplete = stages.find((s) => s.status !== "completed");
    if (firstIncomplete) {
      firstIncomplete.status = "failed";
      firstIncomplete.note = req.failureReason ?? "This step failed.";
    }
  }

  return stages;
}

export type { StageId };
