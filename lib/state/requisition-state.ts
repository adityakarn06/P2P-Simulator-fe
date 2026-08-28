import { formatStatus } from "@/lib/formatters";
import { canUploadInvoice, getInvoicePollInterval } from "@/lib/state/invoice-state";
import type { WorkflowStage } from "@/components/workflow/workflow-step";
import type {
  Requisition,
  RequisitionStatus,
  InvoiceStatus,
  Invoice,
  Shipment,
  GoodsReceipt,
} from "@/types/models";

/**
 * All derivation logic for the requisition intake screens lives here, kept
 * free of React so it can be unit tested directly (see
 * __tests__/requisition-state.test.ts).
 *
 * The single source of truth is GET /requisitions/:id (a `Requisition`).
 *
 * The POST response's `status` is now authoritative (backend-docs/requisitions-api.md):
 * the completion turn returns `"REQUIREMENTS_EXTRACTED"`, and `"PROCESSING"`
 * appears on a 202 only — the worker had not answered in time, so poll
 * GET /requisitions/:id. A turn may also come back `SUPPLIER_SELECTED`,
 * `PO_CREATED` or `FAILED`, meaning the requisition had already moved past the
 * conversation and nothing was changed. We still detect completion with
 * `requirements != null`, which holds under both the old and new contract.
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

export interface StageActivity {
  stageId: StageId;
  label: string;
}

/**
 * The one thing allowed to drive an animated "worker is running" indicator on
 * /requisitions/[id]. Returns non-null ONLY while a backend job is genuinely
 * in flight — never for a state that is waiting on a human (those belong to
 * `getAwaitingAction` below, and must never look like machine progress).
 *
 * The guarantee is structural, not a hand-maintained status list: the
 * requisition branch is gated on `isPolling(status)` — the same predicate
 * that drives this screen's own `refetchInterval`
 * (hooks/use-requisition-detail.ts) — and the invoice branch on
 * `getInvoicePollInterval(status) !== false`. If a status stops being
 * polled, its spinner stops with it.
 *
 * Polling is necessary but NOT sufficient: `EXCEPTION` also keeps polling
 * (lib/state/invoice-state.ts) even though nothing is running — it only
 * clears once a human resolves the exception on /exceptions/:id
 * (backend-docs/exceptions-api.md). That case is excluded here and handled
 * by `getAwaitingAction` instead.
 *
 * Which stage is "running" is derived from the presence of real backend
 * objects (`requirement` → `sourcing` → `purchaseOrder`), never from the
 * status string alone — same doctrine as `deriveWorkflowStages`. This is
 * also what correctly resolves the completion-turn trap (status stays
 * `PROCESSING` once requirements are extracted — see the file header) to
 * "Supplier discovery…" rather than "AI processing…".
 *
 * No percentages, no ETA — the backend exposes no progress signal for any
 * of these jobs.
 */
export function getWorkerActivity(
  req: Pick<Requisition, "status" | "requirement" | "sourcing" | "purchaseOrder">,
  latestInvoiceStatus?: InvoiceStatus | null
): StageActivity | null {
  if (isPolling(req.status)) {
    if (req.requirement == null) {
      return { stageId: "requirements", label: "AI processing…" };
    }
    if (req.sourcing == null) {
      return { stageId: "sourcing", label: "Supplier discovery…" };
    }
    if (req.purchaseOrder == null) {
      return { stageId: "purchase-order", label: "Generating PO…" };
    }
    // A PO already exists while still polling — a one-tick race before
    // status flips to PO_CREATED. Nothing requisition-side is running;
    // fall through to the invoice check below.
  }

  if (latestInvoiceStatus == null) return null;
  // Necessary-but-not-sufficient check: EXCEPTION also returns a number here
  // (see doc comment above), so it must not be handled by this switch.
  if (getInvoicePollInterval(latestInvoiceStatus) === false) return null;

  switch (latestInvoiceStatus) {
    case "UPLOADED":
    case "PROCESSING":
      return { stageId: "invoice", label: "Extracting invoice…" };
    case "EXTRACTED":
    case "MATCHING":
      return { stageId: "matching", label: "Checking invoice…" };
    case "APPROVED":
      return { stageId: "payment", label: "Payment processing…" };
    default:
      // EXCEPTION: polling but blocked on a human — see getAwaitingAction.
      return null;
  }
}

/**
 * The mirror of `getWorkerActivity`: the single step currently blocked on
 * the user, so the UI can show a static "awaiting you" chip instead of an
 * animated one. By construction the two functions never name the same
 * stage for the same input — every branch here corresponds to a status
 * `getWorkerActivity` deliberately does not poll (or, for EXCEPTION, polls
 * for a reason other than a worker running).
 */
export function getAwaitingAction(
  req: Pick<Requisition, "status" | "purchaseOrder">,
  latestInvoiceStatus?: InvoiceStatus | null
): StageActivity | null {
  // A failed requisition is never blocked on the user — it has its own
  // failed-stage UI (see the FAILED override in deriveWorkflowStages), not
  // an "awaiting you" chip on a step that will never move forward.
  if (req.status === "FAILED") return null;

  const po = req.purchaseOrder;

  // Matching found a mismatch; only a human resolving it on /exceptions/:id
  // moves it forward (backend-docs/exceptions-api.md). Checked first since
  // it can coexist with an earlier PO/shipment state.
  if (latestInvoiceStatus === "EXCEPTION") {
    return { stageId: "matching", label: "Awaiting your review" };
  }

  if (po != null) {
    if (po.status === "PENDING_APPROVAL") {
      return { stageId: "purchase-order", label: "Awaiting your approval" };
    }
    // Delivery only advances via POST /receipts/simulate — no carrier
    // integration, no timer (backend-docs/shipments-api.md).
    if (po.status === "APPROVED" || po.status === "SHIPPED") {
      return { stageId: "shipment", label: "Awaiting delivery simulation" };
    }
    // PO can be invoiced and the invoices list has resolved empty (`null`,
    // not the unresolved `undefined`) — mirrors the note already attached
    // to the Invoice stage in deriveWorkflowStages.
    if (
      latestInvoiceStatus === null &&
      (po.status === "RECEIVED" || po.status === "COMPLETED")
    ) {
      return { stageId: "invoice", label: "Awaiting invoice upload" };
    }
    return null;
  }

  // The clarification loop: composer is open and the backend 409s any
  // message once status moves past this.
  if (req.status === "NEEDS_CLARIFICATION") {
    return { stageId: "requirements", label: "Awaiting your reply" };
  }

  return null;
}

/**
 * Maps real requisition state to WorkflowStage[] for WorkflowTimeline.
 * Only ever marks a stage "completed" from the presence of a real backend
 * object (`requirement`, `sourcing`, `purchaseOrder`) — never from the
 * status string alone.
 *
 * Shipment/goods-receipt derive from `purchaseOrder.status`, which IS
 * embedded on the requisition — the requisition's own `status` never
 * advances past PO_CREATED (backend-docs/README.md). Invoice status comes
 * from the caller (this screen fetches it separately, since Invoice has no
 * requisitionId of its own — see hooks/use-requisition-detail.ts). Matching
 * and payment are tracked on the invoice too, but have no dedicated UI yet,
 * so they stay "pending".
 */
/**
 * Maps the latest invoice's status to the Invoice stage's WorkflowStepStatus.
 * `null` means the invoices list has resolved and confirmed none exist yet —
 * active once the PO can accept one, pending before that. `undefined` means
 * the caller doesn't know yet (the invoices list query hasn't resolved for
 * the first time) — stays pending rather than flashing "active" for a PO
 * that may already have an invoice in flight.
 */
function invoiceStageStatus(
  status: InvoiceStatus | null | undefined,
  poCanAcceptInvoice: boolean
): WorkflowStage["status"] {
  if (status === undefined) return "pending";
  if (status === null) return poCanAcceptInvoice ? "active" : "pending";
  switch (status) {
    case "FAILED":
      return "failed";
    case "UPLOADED":
    case "PROCESSING":
      return "active";
    case "EXTRACTED":
    case "MATCHING":
    case "APPROVED":
    case "EXCEPTION":
    case "PARTIALLY_PAID":
    case "PAID":
      return "completed";
    default:
      return "pending";
  }
}

/**
 * Maps the latest invoice's status to the Matching stage's WorkflowStepStatus.
 * Matching is queued automatically once extraction finishes (EXTRACTED) and
 * runs deterministically (no AI) — see backend-docs/invoices-api.md. There is
 * no dedicated matching API; Invoice.status is the only signal.
 */
function matchingStageStatus(status: InvoiceStatus | null | undefined): WorkflowStage["status"] {
  switch (status) {
    case "EXTRACTED":
    case "MATCHING":
      return "active";
    case "APPROVED":
    case "PAID":
    // A partial payment is only reached by a human overriding a mismatch, so
    // matching is finished either way — leaving this to the default would show
    // the stage as untouched next to an invoice that has already been settled.
    case "PARTIALLY_PAID":
      return "completed";
    case "EXCEPTION":
      return "failed";
    default:
      return "pending";
  }
}

/**
 * Maps the latest invoice's status to the Payment stage's WorkflowStepStatus.
 * Payment is queued automatically once matching approves the invoice
 * (APPROVED) and there is no Payment read endpoint — APPROVED vs PAID is the
 * only signal (backend-docs/invoices-api.md).
 */
function paymentStageStatus(status: InvoiceStatus | null | undefined): WorkflowStage["status"] {
  switch (status) {
    case "APPROVED":
      return "active";
    case "PAID":
    // Money has moved: the settlement was smaller than billed, but the payment
    // stage itself is done — a balance outstanding is an invoice fact, not an
    // unfinished workflow step.
    case "PARTIALLY_PAID":
      return "completed";
    default:
      return "pending";
  }
}

export function deriveWorkflowStages(
  req: Pick<
    Requisition,
    "status" | "requirement" | "sourcing" | "purchaseOrder" | "failureReason" | "createdAt"
  >,
  latestInvoiceStatus?: InvoiceStatus | null,
  /**
   * Real per-stage timestamps sourced from data the backend actually
   * returns — never derived or guessed. Invoice/PurchaseOrder have no
   * matchedAt/paidAt field, so matchCompletedAt/paymentCompletedAt come
   * from the audit trail's MATCH_COMPLETED/PAYMENT_COMPLETED rows instead
   * (the only place those moments are recorded — backend-docs/audit-logs-api.md).
   * The Requirements stage still has no dedicated field anywhere (not even
   * in the audit log's REQUIREMENTS_EXTRACTED row is it threaded through
   * here) and renders without a timestamp rather than a borrowed one.
   */
  extra?: {
    latestInvoice?: Pick<Invoice, "createdAt" | "extractedAt"> | null;
    shipment?: Pick<Shipment, "shippedAt"> | null;
    goodsReceipt?: Pick<GoodsReceipt, "receivedAt"> | null;
    /** ISO 8601 — the invoice's MATCH_COMPLETED audit log row, if any. */
    matchCompletedAt?: string | null;
    /** ISO 8601 — the invoice's PAYMENT_COMPLETED audit log row, if any. */
    paymentCompletedAt?: string | null;
  }
): WorkflowStage[] {
  const po = req.purchaseOrder;
  const poStatus = po?.status ?? null;
  const poRejected = poStatus === "REJECTED";

  const shipmentCompleted = poStatus === "RECEIVED" || poStatus === "COMPLETED";
  const shipmentActive = poStatus === "APPROVED" || poStatus === "SHIPPED";
  // Wider than shipmentCompleted — an invoice can be uploaded from APPROVED
  // onward (backend-docs/invoices-api.md), matching shouldShowInvoiceSection.
  const poCanAcceptInvoice = po != null && canUploadInvoice(po);

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
      timestamp: req.sourcing?.decidedAt ?? null,
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
      timestamp: poRejected ? po?.rejectedAt : po?.createdAt,
    },
    {
      id: "shipment",
      label: "Shipment",
      status: shipmentCompleted ? "completed" : shipmentActive ? "active" : "pending",
      timestamp: extra?.shipment?.shippedAt ?? null,
    },
    {
      id: "goods-receipt",
      label: "Goods Receipt",
      status: shipmentCompleted ? "completed" : "pending",
      timestamp: extra?.goodsReceipt?.receivedAt ?? null,
    },
    {
      id: "invoice",
      label: "Invoice",
      status: invoiceStageStatus(latestInvoiceStatus, poCanAcceptInvoice),
      timestamp: extra?.latestInvoice?.extractedAt ?? extra?.latestInvoice?.createdAt ?? null,
      note:
        latestInvoiceStatus === null
          ? poCanAcceptInvoice
            ? "Upload the supplier invoice to continue."
            : null
          : latestInvoiceStatus === "FAILED"
            ? "Extraction failed — re-upload the document to retry."
            : null,
    },
    {
      id: "matching",
      label: "Matching",
      status: matchingStageStatus(latestInvoiceStatus),
      timestamp: extra?.matchCompletedAt ?? null,
      note:
        latestInvoiceStatus === "EXCEPTION"
          ? "Mismatch found — review the exception."
          : null,
    },
    {
      id: "payment",
      label: "Payment",
      status: paymentStageStatus(latestInvoiceStatus),
      timestamp: extra?.paymentCompletedAt ?? null,
      note: latestInvoiceStatus === "APPROVED" ? "Payment processing." : null,
    },
  ];

  // Attach the "what's happening right now" caption to whichever stage it
  // names. The two functions are designed to never name the same stage for
  // the same input, so both are attached independently rather than treating
  // worker activity as suppressing awaiting-action — a PO already APPROVED
  // and an invoice already extracting are two different, simultaneously
  // true captions on two different stages (shipment vs. invoice).
  const awaitingAction = getAwaitingAction(req, latestInvoiceStatus);
  if (awaitingAction) {
    const target = stages.find((s) => s.id === awaitingAction.stageId);
    if (target) {
      target.activity = { label: awaitingAction.label, variant: "awaiting" };
    }
  }
  const workerActivity = getWorkerActivity(req, latestInvoiceStatus);
  if (workerActivity) {
    const target = stages.find((s) => s.id === workerActivity.stageId);
    if (target) {
      target.activity = { label: workerActivity.label, variant: "working" };
    }
  }

  if (req.status === "FAILED" && !poRejected) {
    const firstIncomplete = stages.find((s) => s.status !== "completed");
    if (firstIncomplete) {
      firstIncomplete.status = "failed";
      firstIncomplete.note = req.failureReason ?? "This step failed.";
      // A stage can't render as both failed and captioned with a stale
      // "awaiting"/"working" label — getAwaitingAction already returns null
      // for FAILED, but this covers a worker-activity caption reused from a
      // stale render.
      firstIncomplete.activity = null;
    }
  }

  return stages;
}

export interface WorkflowProgress {
  /** Number of stages with status "completed". A "failed" stage does not count as completed. */
  completed: number;
  /** Total number of stages in the workflow (never hardcoded — the length of the derived array). */
  total: number;
  /** Rounded percentage of stages completed, 0-100. */
  percent: number;
}

/**
 * Session-wide P2P workflow completion, derived from the same
 * `deriveWorkflowStages` output the timeline renders — so the progress
 * gauge and the timeline can never disagree about what's done.
 */
export function getWorkflowProgress(stages: WorkflowStage[]): WorkflowProgress {
  const total = stages.length;
  const completed = stages.filter((s) => s.status === "completed").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export type { StageId };
