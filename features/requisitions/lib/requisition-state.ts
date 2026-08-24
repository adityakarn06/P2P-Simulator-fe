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
 * Faster while an extraction turn is running (CREATED/PROCESSING); slower
 * while a downstream worker (sourcing, PO generation) is running; stopped
 * whenever the requisition is actionable or terminal.
 */
export function getPollInterval(status: RequisitionStatus): number | false {
  switch (status) {
    case "CREATED":
    case "PROCESSING":
      return 2000;
    case "REQUIREMENTS_EXTRACTED":
    case "SUPPLIER_SELECTED":
      return 4000;
    case "NEEDS_CLARIFICATION":
    case "PO_CREATED":
    case "FAILED":
      return false;
    default:
      return false;
  }
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
  const dateStr = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(
    deadline
  );
  const label = days === 1 ? "1 day" : `${days} days`;
  return `${label} (by ${dateStr})`;
}

type StageId = "request" | "requirements" | "sourcing" | "purchase-order";

/**
 * Maps real requisition state to WorkflowStage[] for WorkflowTimeline.
 * Only ever marks a stage "completed" from the presence of a real backend
 * object (`requirement`, `sourcing`, `purchaseOrder`) — never from the
 * status string alone.
 */
export function deriveWorkflowStages(
  req: Pick<
    Requisition,
    "status" | "requirement" | "sourcing" | "purchaseOrder" | "failureReason" | "createdAt"
  >
): WorkflowStage[] {
  const stages: WorkflowStage[] = [
    {
      id: "request",
      label: "Request",
      status: "completed",
      timestamp: req.createdAt,
    },
    {
      id: "requirements",
      label: "Requirements",
      status: req.requirement != null
        ? "completed"
        : req.status === "FAILED"
          ? "pending"
          : "active",
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
      status: req.purchaseOrder != null
        ? "completed"
        : req.status === "SUPPLIER_SELECTED"
          ? "active"
          : "pending",
    },
  ];

  if (req.status === "FAILED") {
    const firstIncomplete = stages.find((s) => s.status !== "completed");
    if (firstIncomplete) {
      firstIncomplete.status = "failed";
      firstIncomplete.note = req.failureReason ?? "This step failed.";
    }
  }

  return stages;
}

export type { StageId };
