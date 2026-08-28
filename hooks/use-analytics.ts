"use client";

import {
  useQuery,
  useInfiniteQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getAnalyticsSummary,
  getSupplierScorecard,
  listAnomalies,
  type AnalyticsWindowParams,
  type ListAnomaliesParams,
  type SupplierScorecardParams,
} from "@/lib/api/analytics";
import type {
  AnalyticsSummary,
  AnomalySignal,
  SupplierScorecardRow,
} from "@/types/analytics";
import type { CursorPaginatedData } from "@/types/api";

export const analyticsKeys = {
  all: ["analytics"] as const,
  summary: (params: AnalyticsWindowParams) =>
    [...analyticsKeys.all, "summary", params] as const,
  suppliers: (params: SupplierScorecardParams) =>
    [...analyticsKeys.all, "suppliers", params] as const,
  anomalies: (params: ListAnomaliesParams) =>
    [...analyticsKeys.all, "anomalies", params] as const,
  anomaliesInfinite: (params: ListAnomaliesParams) =>
    [...analyticsKeys.all, "anomalies", params, "infinite"] as const,
} as const;

/**
 * GET /analytics/summary — the whole dashboard in one call.
 * Query key: ["analytics", "summary", { from, to }]
 */
export function useAnalyticsSummary(
  params: AnalyticsWindowParams = {},
  options?: Omit<UseQueryOptions<AnalyticsSummary>, "queryKey" | "queryFn">
) {
  return useQuery<AnalyticsSummary>({
    queryKey: analyticsKeys.summary(params),
    queryFn: () => getAnalyticsSummary(params),
    ...options,
  });
}

/**
 * GET /analytics/suppliers — the vendor scorecard.
 * Query key: ["analytics", "suppliers", { limit }]
 *
 * Takes no date window: the scores are cumulative counters recomputed on every
 * goods receipt, not period aggregates.
 */
export function useSupplierScorecard(
  params: SupplierScorecardParams = {},
  options?: Omit<UseQueryOptions<SupplierScorecardRow[]>, "queryKey" | "queryFn">
) {
  return useQuery<SupplierScorecardRow[]>({
    queryKey: analyticsKeys.suppliers(params),
    queryFn: () => getSupplierScorecard(params),
    ...options,
  });
}

/**
 * GET /analytics/anomalies — one page of the advisory feed.
 * Query key: ["analytics", "anomalies", filters]
 *
 * Use this when scoping to a single entity (`entityId`) for an inline callout;
 * use the infinite variant for the dashboard feed.
 */
export function useAnomalies(
  params: ListAnomaliesParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<AnomalySignal>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<AnomalySignal>>({
    queryKey: analyticsKeys.anomalies(params),
    queryFn: () => listAnomalies(params),
    ...options,
  });
}

/**
 * Cursor-paginated anomaly feed — mirrors useInfiniteAuditLogs.
 * Query key: ["analytics", "anomalies", filters, "infinite"]
 */
export function useInfiniteAnomalies(params: ListAnomaliesParams = {}) {
  return useInfiniteQuery({
    queryKey: analyticsKeys.anomaliesInfinite(params),
    queryFn: ({ pageParam }) =>
      listAnomalies({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CursorPaginatedData<AnomalySignal>) =>
      lastPage.nextCursor ?? undefined,
  });
}
