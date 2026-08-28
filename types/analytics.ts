import type {
  EntityType,
  ExceptionType,
  InvoiceStatus,
  PurchaseOrderStatus,
  RequisitionStatus,
} from "./models";

/**
 * Types for GET /analytics/summary | /suppliers | /anomalies.
 *
 * Source of truth: backend-docs/analytics-api.md. Read-only aggregation —
 * nothing here writes, enqueues, or decides.
 *
 * Two conventions run through every shape below and both are load-bearing:
 *
 *  - **Money is an object**, never a bare number. `paise` is the integer to
 *    compute with; `display` is pre-formatted with en-IN lakh grouping and is
 *    for rendering only. Never parse `display` back into a number.
 *  - **Rates are 0–1, and `null` — not `0` — when the denominator is empty.**
 *    "Nothing has happened yet" and "nothing worked" are opposite facts and
 *    must not render the same way.
 */

/** Money as the analytics endpoints report it. Compute with `paise`, render `display`. */
export interface MoneyValue {
  /** Integer minor units (paise). The only field safe to do arithmetic on. */
  paise: number;
  /** Pre-formatted, en-IN grouping, e.g. "₹2,14,760.00". Render only — never parse. */
  display: string;
}

/**
 * A duration distribution, in hours. Median and p90 are reported alongside the
 * mean because procurement durations are skewed — one requisition left over a
 * weekend drags a mean into something no buyer recognises as their own process.
 */
export interface DurationStats {
  count: number;
  meanHours: number;
  medianHours: number;
  p90Hours: number;
}

/**
 * Counts by status. Every status in the enum is present with a `0`, so a chart
 * keeps a stable axis on an empty organization.
 */
export interface AnalyticsFunnel {
  requisitions: Record<RequisitionStatus, number>;
  purchaseOrders: Record<PurchaseOrderStatus, number>;
  /**
   * `GENERATED` invoices — the convenience PDFs this system renders from a PO —
   * are excluded server-side; counting them as invoices received would double
   * the funnel.
   */
  invoices: Record<InvoiceStatus, number>;
  payments: Record<string, number>;
}

export interface AnalyticsAutomation {
  /**
   * Invoices that reached PAID with **no exception ever raised** against them,
   * over invoices that reached a terminal state (PAID / EXCEPTION / FAILED).
   *
   * Invoice-side only, and it must be labelled as such in any UI: purchase-order
   * approval is deliberately a human step in this build, so an end-to-end
   * "touchless" number would be 0 by construction and would say nothing about
   * how well the automation works. Note also that a *resolved* exception still
   * disqualifies an invoice — a human touched it.
   */
  touchlessInvoiceRate: number | null;
  /** Numerator and denominator, so the rate can be recomputed and shown in full. */
  touchlessInvoices: number;
  terminalInvoices: number;
  /** ThreeWayMatch rows that came back MATCHED, over all matches run. */
  firstPassMatchRate: number | null;
  /** Paid invoices that needed a human to clear an exception first. */
  invoicesRequiringReview: number;
}

/**
 * Measured from entity timestamps, not the audit log. A flow that has not
 * finished contributes nothing rather than counting as instant, so `count` may
 * legitimately differ between stages.
 */
export interface AnalyticsCycleTimes {
  requisitionToPurchaseOrder: DurationStats;
  purchaseOrderToApproval: DurationStats;
  approvalToDelivery: DurationStats;
  invoiceToPayment: DurationStats;
  endToEnd: DurationStats;
}

export interface ExceptionTypeBreakdown {
  type: ExceptionType;
  /** OPEN and UNDER_REVIEW are both folded in here — the split is workflow detail. */
  open: number;
  resolved: number;
  rejected: number;
  total: number;
}

export interface AnalyticsExceptions {
  /** One row per ExceptionType, sorted by total descending. */
  byType: ExceptionTypeBreakdown[];
  openTotal: number;
  meanResolutionHours: number | null;
}

export interface TopSupplierSpend {
  supplierId: string;
  supplierName: string;
  spend: MoneyValue;
  purchaseOrders: number;
}

export interface AnalyticsSpend {
  /** Every non-REJECTED purchase order. */
  committed: MoneyValue;
  /** Completed payments. */
  paid: MoneyValue;
  /** Payments held by an open exception. */
  blocked: MoneyValue;
  /** Top 10 by committed value. */
  topSuppliers: TopSupplierSpend[];
}

/**
 * Per AI job type, from AIProcessingLog. The latency percentiles are what tell
 * you whether the Gemini calls are why the workflow feels slow.
 */
export interface AiJobStats {
  jobType: string;
  runs: number;
  successRate: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
}

export interface AnalyticsSummary {
  funnel: AnalyticsFunnel;
  automation: AnalyticsAutomation;
  cycleTimes: AnalyticsCycleTimes;
  exceptions: AnalyticsExceptions;
  spend: AnalyticsSpend;
  ai: AiJobStats[];
}

/**
 * One row of the vendor scorecard.
 *
 * A supplier that has never delivered reports `null` for every rate, not `0`.
 *
 * `reliabilityScore` is not decoration: it carries the RELIABILITY weight (20%)
 * in the supplier score, so this row shows exactly why the next requisition
 * will pick who it picks. It is recomputed from OTIF on every goods receipt and
 * shrunk toward `baselineReliability` (the score the supplier was onboarded
 * with), so one bad delivery moves it without destroying the supplier.
 * `reliabilityDelta` is the movement since onboarding.
 */
export interface SupplierScorecardRow {
  supplierId: string;
  supplierName: string;
  isActive: boolean;
  rating: number | null;
  onTimeRate: number | null;
  inFullRate: number | null;
  /** `onTimeRate × inFullRate` — an approximation; the counters do not record which deliveries were both. */
  otifRate: number | null;
  damageRate: number | null;
  avgLeadTimeDays: number | null;
  totalDeliveries: number;
  reliabilityScore: number | null;
  baselineReliability: number | null;
  reliabilityDelta: number | null;
  purchaseOrders: number;
  spend: MoneyValue;
  /** ISO 8601 or null */
  lastDeliveryAt: string | null;
}

export type AnomalySeverity = "INFO" | "WARNING" | "CRITICAL";

export type AnomalySignalType =
  | "PRICE_OUTLIER"
  | "QUANTITY_OUTLIER"
  | "NEW_SUPPLIER_HIGH_VALUE"
  | "PREDICTED_LATE_DELIVERY"
  | "SUPPLIER_DEGRADATION"
  | "NEAR_DUPLICATE_INVOICE";

/**
 * An advisory signal, and the advisory part is load-bearing: a signal **never**
 * blocks a payment, raises an Exception, or changes a three-way-match verdict.
 * Three-way matching is the only financial gate and the payment rules the only
 * payment one. Signals live in their own table for exactly this reason —
 * filing a heuristic as an Exception would silently block money.
 *
 * These are deterministic statistics over the organization's own history, not
 * a model, and every one ships with the sentence that explains it.
 */
export interface AnomalySignal {
  id: string;
  signalType: AnomalySignalType;
  severity: AnomalySeverity;
  entityType: EntityType;
  entityId: string;
  score: number;
  /** Human-readable observed value, e.g. "Wireless Keyboard: ₹3,000.00" */
  observed: string;
  /** Human-readable comparison, e.g. "₹1,820.00 average over 4 prior order line(s)" */
  baseline: string;
  /** Full prose explanation — always render this rather than reconstructing one. */
  explanation: string;
  metadata: Record<string, unknown>;
  /** ISO 8601 */
  createdAt: string;
}
