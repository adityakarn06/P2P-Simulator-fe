/**
 * Analytics dashboard state-derivation tests.
 *
 * Runner: node --test (see package.json "test" script). `@/` imports are
 * resolved by __tests__/alias-loader.mjs, registered via `--import`.
 *
 * The invariants under test all come from backend-docs/analytics-api.md, and
 * every one of them is a way the dashboard could quietly lie:
 *   - a `null` rate is an empty denominator, not a zero result
 *   - the funnel keeps every status key so an empty org still has an axis
 *   - a zero-count cycle-time stage has no measurement and must be dropped,
 *     not plotted as "takes no time"
 *   - money is computed from `paise`; `display` is never parsed back
 *   - "all time" sends no bounds — the API has no default window on purpose
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  NO_VALUE,
  formatRate,
  formatCount,
  formatDuration,
  formatLatency,
  toFunnelChartData,
  toFunnelStageTotals,
  toCycleTimeChartData,
  toExceptionBreakdownData,
  toTopSupplierSpendData,
  summarizeAutomation,
  reliabilityTrend,
  hasNoDeliveries,
  anomalySeverityRank,
  anomalyToneClass,
  toAiJobRows,
  presetToWindow,
} from "@/lib/state/analytics-state";
import type {
  AnalyticsAutomation,
  AnalyticsCycleTimes,
  AnalyticsExceptions,
  AnalyticsFunnel,
  DurationStats,
} from "@/types/analytics";

function stats(overrides: Partial<DurationStats> = {}): DurationStats {
  return { count: 3, meanHours: 10, medianHours: 8, p90Hours: 20, ...overrides };
}

function makeCycleTimes(overrides: Partial<AnalyticsCycleTimes> = {}): AnalyticsCycleTimes {
  return {
    requisitionToPurchaseOrder: stats(),
    purchaseOrderToApproval: stats(),
    approvalToDelivery: stats(),
    invoiceToPayment: stats(),
    endToEnd: stats(),
    ...overrides,
  };
}

// ── Rates ────────────────────────────────────────────────────────────────────

describe("formatRate", () => {
  test("null is an empty denominator, and never renders as 0%", () => {
    assert.equal(formatRate(null), NO_VALUE);
    assert.equal(formatRate(undefined), NO_VALUE);
    assert.notEqual(formatRate(null), formatRate(0));
  });

  test("0 is a real result and renders as 0%", () => {
    assert.equal(formatRate(0), "0.0%");
  });

  test("rates are 0–1, not percentages", () => {
    assert.equal(formatRate(1), "100.0%");
    assert.equal(formatRate(0.375), "37.5%");
  });
});

describe("formatCount", () => {
  test("null renders as the no-value marker", () => {
    assert.equal(formatCount(null), NO_VALUE);
    assert.equal(formatCount(0), "0");
  });
});

// ── Durations ────────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  test("sub-hour durations are minutes", () => {
    assert.equal(formatDuration(0.5), "30m");
  });

  test("sub-day durations are hours and minutes", () => {
    assert.equal(formatDuration(2), "2h");
    assert.equal(formatDuration(2.25), "2h 15m");
  });

  test("longer durations are days", () => {
    assert.equal(formatDuration(36), "1.5 days");
  });

  test("absent or nonsensical durations render as the no-value marker", () => {
    assert.equal(formatDuration(null), NO_VALUE);
    assert.equal(formatDuration(Number.NaN), NO_VALUE);
    assert.equal(formatDuration(-1), NO_VALUE);
  });
});

describe("formatLatency", () => {
  test("milliseconds under a second, seconds above", () => {
    assert.equal(formatLatency(420), "420ms");
    assert.equal(formatLatency(2500), "2.5s");
    assert.equal(formatLatency(null), NO_VALUE);
  });
});

// ── Funnel ───────────────────────────────────────────────────────────────────

describe("toFunnelChartData", () => {
  test("keeps zero-count statuses so an empty org still has a stable axis", () => {
    const rows = toFunnelChartData({ CREATED: 0, PROCESSING: 0, FAILED: 0 });
    assert.equal(rows.length, 3, "no status is filtered out for being zero");
    assert.ok(rows.every((r) => r.count === 0));
  });

  test("preserves the API's key order and humanises the label", () => {
    const rows = toFunnelChartData({ PENDING_APPROVAL: 2, APPROVED: 1 });
    assert.deepEqual(
      rows.map((r) => r.status),
      ["PENDING_APPROVAL", "APPROVED"]
    );
    assert.equal(rows[0].label, "Pending Approval");
  });
});

describe("toFunnelStageTotals", () => {
  test("sums each stage and covers all four", () => {
    const funnel = {
      requisitions: { CREATED: 2, FAILED: 1 },
      purchaseOrders: { APPROVED: 3 },
      invoices: { PAID: 1, EXCEPTION: 1 },
      payments: { COMPLETED: 1 },
    } as unknown as AnalyticsFunnel;

    const totals = toFunnelStageTotals(funnel);
    assert.equal(totals.length, 4);
    assert.deepEqual(
      totals.map((t) => t.total),
      [3, 3, 2, 1]
    );
  });

  test("an empty organization yields four zero stages, not an empty chart", () => {
    const empty = {
      requisitions: {},
      purchaseOrders: {},
      invoices: {},
      payments: {},
    } as unknown as AnalyticsFunnel;
    const totals = toFunnelStageTotals(empty);
    assert.equal(totals.length, 4);
    assert.ok(totals.every((t) => t.total === 0));
  });
});

// ── Cycle times ──────────────────────────────────────────────────────────────

describe("toCycleTimeChartData", () => {
  test("drops zero-count stages rather than plotting them as instant", () => {
    const rows = toCycleTimeChartData(
      makeCycleTimes({ invoiceToPayment: stats({ count: 0, meanHours: 0, medianHours: 0, p90Hours: 0 }) })
    );
    assert.equal(rows.length, 4);
    assert.ok(
      !rows.some((r) => r.stage === "invoiceToPayment"),
      "a stage nothing has finished has no measurement at all"
    );
  });

  test("an org where nothing has completed yields no rows, not five zero bars", () => {
    const none = makeCycleTimes({
      requisitionToPurchaseOrder: stats({ count: 0 }),
      purchaseOrderToApproval: stats({ count: 0 }),
      approvalToDelivery: stats({ count: 0 }),
      invoiceToPayment: stats({ count: 0 }),
      endToEnd: stats({ count: 0 }),
    });
    assert.deepEqual(toCycleTimeChartData(none), []);
  });

  test("carries mean, median and p90 through — median is the one to lead with", () => {
    const rows = toCycleTimeChartData(makeCycleTimes());
    assert.equal(rows[0].medianHours, 8);
    assert.equal(rows[0].meanHours, 10);
    assert.equal(rows[0].p90Hours, 20);
  });
});

// ── Exceptions ───────────────────────────────────────────────────────────────

describe("toExceptionBreakdownData", () => {
  test("preserves the API's total-descending order rather than re-sorting", () => {
    const exceptions = {
      byType: [
        { type: "PRICE_MISMATCH", open: 2, resolved: 3, rejected: 0, total: 5 },
        { type: "QUANTITY_MISMATCH", open: 1, resolved: 0, rejected: 0, total: 1 },
      ],
      openTotal: 3,
      meanResolutionHours: 4,
    } as unknown as AnalyticsExceptions;

    const rows = toExceptionBreakdownData(exceptions);
    assert.deepEqual(
      rows.map((r) => r.type),
      ["PRICE_MISMATCH", "QUANTITY_MISMATCH"]
    );
    assert.equal(rows[0].label, "Price Mismatch");
  });

  test("an absent byType is an empty chart, not a crash", () => {
    assert.deepEqual(toExceptionBreakdownData({} as AnalyticsExceptions), []);
  });
});

// ── Spend ────────────────────────────────────────────────────────────────────

describe("toTopSupplierSpendData", () => {
  test("plots paise and renders display — the formatted string is never parsed", () => {
    const rows = toTopSupplierSpendData([
      {
        supplierId: "sup-1",
        supplierName: "TechSource",
        total: { paise: 21476000, display: "₹2,14,760.00" },
        orders: 4,
      },
    ]);
    assert.equal(rows[0].paise, 21476000, "the integer comes straight from paise");
    assert.equal(rows[0].display, "₹2,14,760.00");
    assert.equal(typeof rows[0].paise, "number");
  });

  test("no suppliers yet is an empty array, not a crash", () => {
    assert.deepEqual(toTopSupplierSpendData(undefined), []);
  });
});

// ── Automation ───────────────────────────────────────────────────────────────

describe("summarizeAutomation", () => {
  test("shows the numerator and denominator behind the rate", () => {
    const summary = summarizeAutomation({
      touchlessInvoiceRate: 0.8,
      touchlessInvoices: 12,
      terminalInvoices: 15,
      firstPassMatchRate: 0.5,
      invoicesRequiringReview: 3,
    });
    assert.equal(summary.touchlessRate, "80.0%");
    assert.match(summary.touchlessBasis, /12 of 15/);
  });

  test("an empty denominator says so instead of implying a 0% result", () => {
    const summary = summarizeAutomation({
      touchlessInvoiceRate: null,
      touchlessInvoices: 0,
      terminalInvoices: 0,
      firstPassMatchRate: null,
      invoicesRequiringReview: 0,
    } as AnalyticsAutomation);
    assert.equal(summary.touchlessRate, NO_VALUE);
    assert.match(summary.touchlessBasis, /No invoices/);
  });
});

// ── Supplier scorecard ───────────────────────────────────────────────────────

describe("reliabilityTrend", () => {
  test("null delta has no direction", () => {
    assert.equal(reliabilityTrend(null), null);
  });

  test("movement beyond the noise floor has a direction", () => {
    assert.equal(reliabilityTrend(-0.15), "down");
    assert.equal(reliabilityTrend(0.2), "up");
  });

  test("floating-point noise reads as unchanged, not as an arrow", () => {
    assert.equal(reliabilityTrend(0.0001), "flat");
    assert.equal(reliabilityTrend(0), "flat");
  });
});

describe("hasNoDeliveries", () => {
  test("a supplier that has never delivered is flagged so its nulls render as —", () => {
    assert.equal(hasNoDeliveries({ totalDeliveries: 0 }), true);
    assert.equal(hasNoDeliveries({ totalDeliveries: 4 }), false);
  });
});

// ── Anomalies ────────────────────────────────────────────────────────────────

describe("anomaly severity", () => {
  test("ranks critical above warning above info", () => {
    assert.ok(anomalySeverityRank("CRITICAL") > anomalySeverityRank("WARNING"));
    assert.ok(anomalySeverityRank("WARNING") > anomalySeverityRank("INFO"));
  });

  test("every severity has a tone", () => {
    for (const severity of ["CRITICAL", "WARNING", "INFO"] as const) {
      assert.ok(anomalyToneClass(severity).length > 0);
    }
  });
});

// ── AI stats ─────────────────────────────────────────────────────────────────

describe("toAiJobRows", () => {
  test("formats rates and latencies, keeping nulls distinct from zeros", () => {
    const rows = toAiJobRows({
      byJobType: [
        { jobType: "INVOICE_EXTRACTION", runs: 4, successRate: 1, p50LatencyMs: 900, p95LatencyMs: 2400 },
        { jobType: "REQUIREMENT_EXTRACTION", runs: 0, successRate: null, p50LatencyMs: null, p95LatencyMs: null },
      ],
    });
    assert.equal(rows[0].successRate, "100.0%");
    assert.equal(rows[0].p95, "2.4s");
    assert.equal(rows[1].successRate, NO_VALUE);
    assert.equal(rows[1].p50, NO_VALUE);
  });
});

// ── Date window ──────────────────────────────────────────────────────────────

describe("presetToWindow", () => {
  test("all time sends no bounds — the API has no default window by design", () => {
    assert.deepEqual(presetToWindow("all"), {});
  });

  test("a preset sends both bounds", () => {
    const now = new Date("2026-08-29T00:00:00.000Z");
    const window = presetToWindow("7d", now);
    assert.equal(window.to, now.toISOString());
    assert.equal(window.from, new Date("2026-08-22T00:00:00.000Z").toISOString());
  });

  test("from is always before to, so the API never returns 400", () => {
    const now = new Date("2026-08-29T00:00:00.000Z");
    for (const preset of ["7d", "30d"] as const) {
      const w = presetToWindow(preset, now);
      assert.ok(new Date(w.from!).getTime() < new Date(w.to!).getTime());
    }
  });
});
