import { formatStatus } from "@/lib/formatters";
import type {
  AnalyticsAi,
  AnalyticsAutomation,
  AnalyticsCycleTimes,
  AnalyticsExceptions,
  AnalyticsFunnel,
  AnomalySeverity,
  DurationStats,
  SupplierScorecardRow,
  TopSupplierSpend,
} from "@/types/analytics";

/**
 * All derivation logic for the analytics dashboard lives here, kept free of
 * React so it can be unit tested directly (see
 * __tests__/analytics-state.test.ts).
 *
 * Source of truth: backend-docs/analytics-api.md.
 *
 * The rule this file exists to enforce: a rate is `null` when the denominator
 * is empty, and `null` must never render as `0`. "Nothing has happened yet"
 * and "nothing worked" are opposite facts.
 */

/** Refresh cadence for the dashboard. Slower than a workflow screen — nothing here is actionable. */
export const ANALYTICS_POLL_MS = 30_000;

/** The em-dash we render wherever a figure genuinely does not exist yet. */
export const NO_VALUE = "—";

// ── Rates and durations ──────────────────────────────────────────────────────

/**
 * A 0–1 rate as a percentage string. `null` (empty denominator) renders as
 * NO_VALUE, never "0%" — see the file header.
 */
export function formatRate(rate: number | null | undefined): string {
  if (rate == null) return NO_VALUE;
  return `${(rate * 100).toFixed(1)}%`;
}

/** A raw count-based figure, or NO_VALUE when absent. */
export function formatCount(value: number | null | undefined): string {
  if (value == null) return NO_VALUE;
  return new Intl.NumberFormat("en-IN").format(value);
}

/**
 * Hours as something a buyer recognises: minutes under an hour, hours under a
 * day, days beyond that.
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return NO_VALUE;
  if (hours < 0) return NO_VALUE;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) {
    const whole = Math.floor(hours);
    const minutes = Math.round((hours - whole) * 60);
    return minutes === 0 ? `${whole}h` : `${whole}h ${minutes}m`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

// ── Funnel ───────────────────────────────────────────────────────────────────

export interface FunnelRow {
  status: string;
  label: string;
  count: number;
}

/**
 * A status→count record as chart rows, in the order the API returned them.
 *
 * Every status in the enum is present with a `0`, which is the point: the axis
 * stays stable on an empty organization instead of collapsing to nothing. So
 * zero rows are deliberately *kept* here — unlike cycle times below, where a
 * zero means something different.
 */
export function toFunnelChartData(counts: Record<string, number>): FunnelRow[] {
  return Object.entries(counts).map(([status, count]) => ({
    status,
    label: formatStatus(status),
    count,
  }));
}

export type FunnelStage = keyof AnalyticsFunnel;

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  requisitions: "Requisitions",
  purchaseOrders: "Purchase orders",
  /** GENERATED invoices are excluded server-side — counting the convenience PDFs would double the funnel. */
  invoices: "Invoices received",
  payments: "Payments",
};

export interface FunnelStageTotal {
  stage: FunnelStage;
  label: string;
  total: number;
}

/** Stage totals for the top-level funnel bar — the shape of the pipeline at a glance. */
export function toFunnelStageTotals(funnel: AnalyticsFunnel): FunnelStageTotal[] {
  return (Object.keys(FUNNEL_STAGE_LABELS) as FunnelStage[]).map((stage) => ({
    stage,
    label: FUNNEL_STAGE_LABELS[stage],
    total: Object.values(funnel[stage] ?? {}).reduce((sum, n) => sum + n, 0),
  }));
}

// ── Cycle times ──────────────────────────────────────────────────────────────

export const CYCLE_TIME_LABELS: Record<keyof AnalyticsCycleTimes, string> = {
  requisitionToPurchaseOrder: "Request → PO",
  purchaseOrderToApproval: "PO → Approval",
  approvalToDelivery: "Approval → Delivery",
  invoiceToPayment: "Invoice → Payment",
  endToEnd: "End to end",
};

export interface CycleTimeRow {
  stage: keyof AnalyticsCycleTimes;
  label: string;
  count: number;
  meanHours: number;
  medianHours: number;
  p90Hours: number;
}

/**
 * Cycle times as chart rows, **dropping stages with `count === 0`**.
 *
 * A flow that has not finished contributes nothing rather than counting as
 * instant, so a zero-count stage has no measurement at all — plotting it as a
 * zero-hour bar would claim the stage takes no time, which is the opposite of
 * the truth. `count` legitimately differs between stages for this reason.
 */
export function toCycleTimeChartData(cycleTimes: AnalyticsCycleTimes): CycleTimeRow[] {
  return (Object.keys(CYCLE_TIME_LABELS) as (keyof AnalyticsCycleTimes)[])
    .map((stage) => {
      const stats: DurationStats | undefined = cycleTimes?.[stage];
      return {
        stage,
        label: CYCLE_TIME_LABELS[stage],
        count: stats?.count ?? 0,
        meanHours: stats?.meanHours ?? 0,
        medianHours: stats?.medianHours ?? 0,
        p90Hours: stats?.p90Hours ?? 0,
      };
    })
    .filter((row) => row.count > 0);
}

// ── Exceptions ───────────────────────────────────────────────────────────────

export interface ExceptionBreakdownRow {
  type: string;
  label: string;
  open: number;
  resolved: number;
  rejected: number;
  total: number;
}

/**
 * `byType` as chart rows. Already sorted by total descending server-side, so
 * the order is preserved rather than re-sorted. OPEN and UNDER_REVIEW are both
 * folded into `open` by the API — the split is workflow detail a summary does
 * not need.
 */
export function toExceptionBreakdownData(
  exceptions: AnalyticsExceptions
): ExceptionBreakdownRow[] {
  return (exceptions?.byType ?? []).map((row) => ({
    type: row.type,
    label: formatStatus(row.type),
    open: row.open,
    resolved: row.resolved,
    rejected: row.rejected,
    total: row.total,
  }));
}

// ── Spend ────────────────────────────────────────────────────────────────────

export interface SupplierSpendRow {
  supplierId: string;
  label: string;
  /** Integer paise — the only field to compute or plot with. */
  paise: number;
  /** Pre-formatted by the API. Render only; never parsed back into a number. */
  display: string;
  purchaseOrders: number;
}

/**
 * Top suppliers by committed spend, as chart rows.
 *
 * Note `paise` comes from `total.paise` and `display` from `total.display` —
 * the formatted string is never parsed back into a number, per
 * backend-docs/analytics-api.md. The summary endpoint names these fields
 * `orders` / `total`; the vendor scorecard names its own `purchaseOrders` /
 * `spend`. Do not cross the two.
 */
export function toTopSupplierSpendData(
  topSuppliers: TopSupplierSpend[] | undefined
): SupplierSpendRow[] {
  return (topSuppliers ?? []).map((s) => ({
    supplierId: s.supplierId,
    label: s.supplierName,
    paise: s.total?.paise ?? 0,
    display: s.total?.display ?? "",
    purchaseOrders: s.orders,
  }));
}

// ── Automation KPIs ──────────────────────────────────────────────────────────

export interface AutomationSummary {
  touchlessRate: string;
  /** "12 of 15 invoices" — the numerator and denominator behind the rate. */
  touchlessBasis: string;
  firstPassMatchRate: string;
  invoicesRequiringReview: number;
}

/**
 * The automation KPI tile inputs.
 *
 * The touchless rate is **invoice-side only** and every caller must label it as
 * such: purchase-order approval is deliberately a human step in this build, so
 * an end-to-end figure would be 0 by construction and would say nothing about
 * how well the automation works.
 */
export function summarizeAutomation(automation: AnalyticsAutomation): AutomationSummary {
  const terminal = automation?.terminalInvoices ?? 0;
  return {
    touchlessRate: formatRate(automation?.touchlessInvoiceRate),
    touchlessBasis:
      terminal === 0
        ? "No invoices have reached a terminal state yet"
        : `${automation.touchlessInvoices} of ${terminal} completed invoices`,
    firstPassMatchRate: formatRate(automation?.firstPassMatchRate),
    invoicesRequiringReview: automation?.invoicesRequiringReview ?? 0,
  };
}

// ── Supplier scorecard ───────────────────────────────────────────────────────

/**
 * Direction of a supplier's reliability movement since onboarding, or null when
 * there is no measurement. Anything within ±0.01 counts as unchanged rather
 * than rendering an arrow for floating-point noise.
 */
export function reliabilityTrend(
  delta: number | null | undefined
): "up" | "down" | "flat" | null {
  if (delta == null) return null;
  if (delta > 0.01) return "up";
  if (delta < -0.01) return "down";
  return "flat";
}

/**
 * True when a supplier has never delivered, so every rate on the row is `null`
 * and must render as NO_VALUE rather than 0%.
 */
export function hasNoDeliveries(row: Pick<SupplierScorecardRow, "totalDeliveries">): boolean {
  return (row.totalDeliveries ?? 0) === 0;
}

// ── Anomaly feed ─────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1,
};

export function anomalySeverityRank(severity: AnomalySeverity): number {
  return SEVERITY_RANK[severity] ?? 0;
}

/**
 * Row tint for an anomaly's severity, matching how the exceptions inbox tints
 * its rows. Deliberately calmer than the exception palette: a signal is
 * advisory and never blocks a payment, so it must not read as a blocker.
 */
export function anomalyToneClass(severity: AnomalySeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "border-l-2 border-l-red-400 dark:border-l-red-600";
    case "WARNING":
      return "border-l-2 border-l-amber-400 dark:border-l-amber-600";
    default:
      return "border-l-2 border-l-border";
  }
}

// ── AI latency ───────────────────────────────────────────────────────────────

export interface AiJobRow {
  jobType: string;
  label: string;
  runs: number;
  successRate: string;
  p50: string;
  p95: string;
}

/** Latency in ms as a readable string, or NO_VALUE when unmeasured. */
export function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return NO_VALUE;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function toAiJobRows(ai: AnalyticsAi | undefined): AiJobRow[] {
  return (ai?.byJobType ?? []).map((job) => ({
    jobType: job.jobType,
    label: formatStatus(job.jobType),
    runs: job.runs,
    successRate: formatRate(job.successRate),
    p50: formatLatency(job.p50LatencyMs),
    p95: formatLatency(job.p95LatencyMs),
  }));
}

// ── Date window ──────────────────────────────────────────────────────────────

export type DateRangePreset = "all" | "7d" | "30d";

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

/**
 * A preset as the `from`/`to` the API takes.
 *
 * "All time" sends neither bound, which is what the API means by an absent
 * bound. The endpoint has *deliberately no default window* so a dashboard
 * cannot silently report the last 30 days as if it were all time — which is
 * exactly why "all" is the default preset here and the label is always shown.
 */
export function presetToWindow(
  preset: DateRangePreset,
  now: Date = new Date()
): { from?: string; to?: string } {
  if (preset === "all") return {};
  const days = preset === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: now.toISOString() };
}
