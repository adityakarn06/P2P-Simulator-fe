import type { MatchOutcome } from "@/lib/state/match-state";
import type { ExceptionType, InvoiceStatus } from "@/types/models";

/**
 * Sequencing for the animated three-way match on /requisitions/[id] — three
 * rings (purchase order, goods receipt, invoice) that draw one after another,
 * connect, and then resolve into a verdict.
 *
 * Free of React so it can be unit tested directly (see
 * __tests__/match-animation.test.ts).
 *
 * This module decides *when* something is drawn and *which ring* an exception
 * implicates. It never decides whether the match passed — that is
 * `matchOutcome()` in lib/state/match-state.ts, read off the invoice's real
 * status, because the API exposes no read endpoint for a ThreeWayMatch (see
 * backend-docs/exceptions-api.md, "Not yet available"). The animation is a
 * presentation of the backend's verdict, never a substitute for it.
 */

/**
 * What the diagram shows, which is `MatchOutcome` plus one case it does not
 * cover: `PARTIALLY_PAID`.
 *
 * `matchOutcome()` maps that status to "pending" by falling through its
 * default, which would render "matching in progress" over an invoice that has
 * already been settled. It is not "passed" either — a partial payment is
 * reached only through PARTIAL_APPROVE, i.e. the documents genuinely disagreed
 * and a human authorized an amount anyway (backend-docs/exceptions-api.md).
 * "overridden" is that third thing, and it is kept here rather than pushed into
 * match-state so the banner in ThreeWayMatchPanel keeps its current wording.
 */
export type MatchDisplayOutcome = MatchOutcome | "overridden";

/**
 * Folds the invoice's status into the verdict. Only PARTIALLY_PAID changes
 * anything; every other status is already decided correctly by matchOutcome,
 * which reads the open exceptions this function cannot see.
 */
export function getDisplayOutcome(
  outcome: MatchOutcome,
  invoiceStatus: InvoiceStatus
): MatchDisplayOutcome {
  return invoiceStatus === "PARTIALLY_PAID" ? "overridden" : outcome;
}

export type MatchNodeKey = "purchaseOrder" | "goodsReceipt" | "invoice";

export type MatchPhase =
  | "idle"
  | "purchaseOrder"
  | "goodsReceipt"
  | "invoice"
  | "verdict";

/** Phases in the order they play. Each ring draws over MATCH_STEP_MS. */
export const MATCH_PHASES: readonly MatchPhase[] = [
  "idle",
  "purchaseOrder",
  "goodsReceipt",
  "invoice",
  "verdict",
] as const;

/** How long one ring takes to draw, and the gap before the next begins. */
export const MATCH_STEP_MS = 700;

/** The three rings, in draw order. */
export const MATCH_NODE_KEYS: readonly MatchNodeKey[] = [
  "purchaseOrder",
  "goodsReceipt",
  "invoice",
] as const;

export type MatchNodeState = "idle" | "drawing" | "done";

/** How a ring is rendered once it has finished drawing. */
export type MatchNodeTone = "neutral" | "success" | "failure" | "unavailable";

export interface MatchNode {
  key: MatchNodeKey;
  label: string;
  /**
   * True when the document actually exists. A missing goods receipt is drawn
   * as an empty, dashed ring — never as a failure, because a delivery that has
   * not been recorded yet is not a mismatch (see rowStatus in match-state.ts).
   */
  present: boolean;
}

const NODE_LABELS: Record<MatchNodeKey, string> = {
  purchaseOrder: "Purchase order",
  goodsReceipt: "Goods receipt",
  invoice: "Invoice",
};

/**
 * The next phase after `phase`, or null once the sequence has finished. A
 * `pending` outcome stops at "invoice": matching has not returned a verdict, so
 * there is nothing to reveal and claiming one would be a lie.
 */
export function nextPhase(phase: MatchPhase, outcome: MatchDisplayOutcome): MatchPhase | null {
  const stopAt = finalPhase(outcome);
  const index = MATCH_PHASES.indexOf(phase);
  const stopIndex = MATCH_PHASES.indexOf(stopAt);
  if (index < 0 || index >= stopIndex) return null;
  return MATCH_PHASES[index + 1];
}

/**
 * Where the sequence comes to rest. Everything but `pending` reaches the
 * verdict; `pending` holds on the last ring while the matching worker runs.
 */
export function finalPhase(outcome: MatchDisplayOutcome): MatchPhase {
  return outcome === "pending" ? "invoice" : "verdict";
}

/** True once the verdict may be shown at all. */
export function isVerdictVisible(phase: MatchPhase): boolean {
  return phase === "verdict";
}

/**
 * Whether a ring is untouched, mid-draw, or complete at this phase. The ring
 * whose name *is* the current phase is the one drawing; everything earlier in
 * MATCH_NODE_KEYS is done.
 */
export function getNodeState(key: MatchNodeKey, phase: MatchPhase): MatchNodeState {
  const nodeIndex = MATCH_NODE_KEYS.indexOf(key);
  const phaseIndex = MATCH_PHASES.indexOf(phase);
  // "idle" is index 0, so the first ring (nodeIndex 0) draws at phase index 1.
  const drawIndex = nodeIndex + 1;
  if (phaseIndex < drawIndex) return "idle";
  if (phaseIndex === drawIndex) return "drawing";
  return "done";
}

/**
 * Whether the connector *after* node `index` is drawn. It fills only once the
 * ring it leaves has finished, so the line never runs ahead of the document it
 * represents.
 */
export function isConnectorDrawn(index: number, phase: MatchPhase): boolean {
  const next = MATCH_NODE_KEYS[index + 1];
  if (!next) return false;
  const state = getNodeState(next, phase);
  return state === "drawing" || state === "done";
}

/**
 * Which rings an exception implicates, so the failing document is the one that
 * turns red rather than the whole row.
 *
 * Mapped from the `type` table in backend-docs/exceptions-api.md. An unmapped
 * or non-matching type (SYSTEM_FAILURE, PAYMENT_FAILURE, …) implicates nothing
 * specific — the verdict line carries the message instead of a ring pointing at
 * a document that may be perfectly correct.
 */
export function getImplicatedNodes(type: ExceptionType): MatchNodeKey[] {
  switch (type) {
    case "QUANTITY_MISMATCH":
      return ["goodsReceipt", "invoice"];
    case "PRICE_MISMATCH":
    case "TAX_MISMATCH":
    case "TOTAL_MISMATCH":
    case "SUPPLIER_MISMATCH":
    case "DUPLICATE_INVOICE":
    case "INVOICE_EXTRACTION_FAILED":
      return ["invoice"];
    default:
      return [];
  }
}

/** The union of the rings implicated by every open exception on the invoice. */
export function getFailingNodes(types: ExceptionType[]): Set<MatchNodeKey> {
  const failing = new Set<MatchNodeKey>();
  for (const type of types) {
    for (const key of getImplicatedNodes(type)) failing.add(key);
  }
  return failing;
}

/**
 * How a ring should be coloured once drawn.
 *
 * A document that does not exist is "unavailable" whatever the outcome — an
 * absent goods receipt must never render as a failed check. Otherwise a failed
 * match reddens only the implicated rings, and reddens all of them when the
 * exception type points at no document in particular, so the verdict is never
 * shown as a success next to a failure banner.
 */
export function getNodeTone(
  node: MatchNode,
  outcome: MatchDisplayOutcome,
  failingNodes: Set<MatchNodeKey>
): MatchNodeTone {
  if (!node.present) return "unavailable";
  switch (outcome) {
    case "passed":
      return "success";
    case "failed":
      return "failure";
    // An overridden match reddens nothing: its exceptions are decided, so
    // which document was at fault is no longer something this diagram knows,
    // and guessing would point at a document that may be correct.
    case "overridden":
      return "neutral";
    case "exception":
      return failingNodes.size === 0 || failingNodes.has(node.key) ? "failure" : "success";
    default:
      return "neutral";
  }
}

/** The three rings with their labels and whether each document exists. */
export function getMatchNodes(options: {
  hasPurchaseOrder: boolean;
  hasReceipt: boolean;
  hasInvoice: boolean;
}): MatchNode[] {
  return [
    { key: "purchaseOrder", label: NODE_LABELS.purchaseOrder, present: options.hasPurchaseOrder },
    { key: "goodsReceipt", label: NODE_LABELS.goodsReceipt, present: options.hasReceipt },
    { key: "invoice", label: NODE_LABELS.invoice, present: options.hasInvoice },
  ];
}

export interface MatchVerdict {
  title: string;
  detail: string;
  tone: "success" | "warning" | "error" | "progress";
}

/**
 * The verdict copy. Deliberately phrased as the *backend's* conclusion, and
 * never claims a pass for anything but an invoice the backend approved or paid
 * with no exception standing against it.
 */
export function getMatchVerdict(
  outcome: MatchDisplayOutcome,
  hasReceipt: boolean
): MatchVerdict {
  switch (outcome) {
    case "passed":
      return {
        title: "Three-way match passed",
        detail:
          "The purchase order, goods receipt and invoice agree. The invoice was released for payment.",
        tone: "success",
      };
    case "overridden":
      return {
        title: "Settled by approval",
        detail:
          "The documents did not agree. An approver authorized a partial payment, so the invoice is partly settled and a balance is still outstanding.",
        tone: "warning",
      };
    case "exception":
      return {
        title: "Three-way match failed",
        detail:
          "The documents disagree. Payment is held until the exception is decided.",
        tone: "warning",
      };
    case "failed":
      return {
        title: "Invoice never matched",
        detail: "Extraction failed, so there was nothing to compare against the order.",
        tone: "error",
      };
    default:
      return {
        title: hasReceipt ? "Matching in progress" : "Awaiting goods receipt",
        detail: hasReceipt
          ? "The matching worker has not returned a verdict yet."
          : "Only the purchase order and invoice can be compared until delivery is recorded.",
        tone: "progress",
      };
  }
}

/** Screen-reader description of the whole diagram at its current phase. */
export function getMatchAriaLabel(
  outcome: MatchDisplayOutcome,
  hasReceipt: boolean
): string {
  const verdict = getMatchVerdict(outcome, hasReceipt);
  return `Three-way match between the purchase order, goods receipt and invoice. ${verdict.title}. ${verdict.detail}`;
}
