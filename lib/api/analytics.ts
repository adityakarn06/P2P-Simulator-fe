import { apiClient } from "./client";
import type { EntityType } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";
import type {
  AnalyticsSummary,
  AnomalySeverity,
  AnomalySignal,
  AnomalySignalType,
  SupplierScorecardRow,
} from "@/types/analytics";

/**
 * Read-only aggregation over what the workflow has already recorded.
 * Source of truth: backend-docs/analytics-api.md.
 */

export interface AnalyticsWindowParams {
  /**
   * Inclusive lower bound. Anything `new Date()` parses — "2026-08-01" and a
   * full ISO timestamp both work. Absent means "since the beginning".
   *
   * There is deliberately no default window, so a dashboard cannot silently
   * report the last 30 days as if it were all time. `from` after `to` is a
   * 400 VALIDATION_ERROR.
   */
  from?: string;
  /** Inclusive upper bound. Absent means "up to now". */
  to?: string;
}

export interface ListAnomaliesParams extends AnalyticsWindowParams {
  severity?: AnomalySeverity;
  signalType?: AnomalySignalType;
  entityType?: EntityType;
  /** Scope to one record — e.g. every signal raised against a purchase order. */
  entityId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

export interface SupplierScorecardParams {
  /** 1–100, default 50 */
  limit?: number;
}

function windowSearch(params: AnalyticsWindowParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return search;
}

function withQuery(path: string, search: URLSearchParams): string {
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * GET /api/v1/analytics/summary
 * The whole dashboard in one call: funnel, automation, cycle times, exception
 * breakdown, spend, and AI latency.
 */
export async function getAnalyticsSummary(
  params: AnalyticsWindowParams = {}
): Promise<AnalyticsSummary> {
  return apiClient.get<AnalyticsSummary>(withQuery("/analytics/summary", windowSearch(params)));
}

/** GET /analytics/suppliers — response nests under a `suppliers` key. */
interface SupplierScorecardEnvelope {
  suppliers: SupplierScorecardRow[];
}

/**
 * GET /api/v1/analytics/suppliers
 * The vendor scorecard, ordered by reliabilityScore descending — performance
 * only. For the catalog itself (contact details, offers, stock, prices) use
 * GET /suppliers in lib/api/suppliers.ts; GET /suppliers/:id returns this very
 * same scorecard row alongside the supplier, rather than recomputing it.
 *
 * Takes no window: the scores are cumulative counters, not period aggregates.
 */
export async function getSupplierScorecard(
  params: SupplierScorecardParams = {}
): Promise<SupplierScorecardRow[]> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));

  const envelope = await apiClient.get<SupplierScorecardEnvelope>(
    withQuery("/analytics/suppliers", search)
  );
  return envelope.suppliers;
}

/** GET /analytics/anomalies — list response uses a `signals` key (not `items`). */
interface AnomalyListEnvelope {
  signals: AnomalySignal[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/analytics/anomalies
 * Cursor-paginated advisory feed, same pagination shape as /audit-logs.
 *
 * Advisory only — nothing here blocks a payment or raises an exception. Render
 * it as a signal, never as a gate.
 */
export async function listAnomalies(
  params: ListAnomaliesParams = {}
): Promise<CursorPaginatedData<AnomalySignal>> {
  const search = windowSearch(params);
  if (params.severity) search.set("severity", params.severity);
  if (params.signalType) search.set("signalType", params.signalType);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const envelope = await apiClient.get<AnomalyListEnvelope>(
    withQuery("/analytics/anomalies", search)
  );

  // Normalise to the standard cursor shape used across the API layer.
  return {
    items: envelope.signals,
    nextCursor: envelope.nextCursor,
  };
}
