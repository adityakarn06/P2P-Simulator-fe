"use client";

import { useMemo } from "react";
import {
  useAnalyticsSummary,
  useSupplierScorecard,
  useInfiniteAnomalies,
} from "@/hooks/use-analytics";
import { ANALYTICS_POLL_MS, presetToWindow } from "@/lib/state/analytics-state";
import { useDashboardStore, ANOMALY_FILTER_ALL } from "@/store/dashboard-store";

/**
 * Everything the dashboard screen needs: the summary, the vendor scorecard and
 * the advisory anomaly feed, plus the date-range and anomaly filters.
 *
 * Polled slowly. Nothing on this screen is actionable — it is an aggregation
 * of work that has already happened, not a workflow state anyone is waiting
 * on — so it does not deserve the ~1s cadence the pipeline screens use.
 */
export function useDashboard() {
  const range = useDashboardStore((s) => s.range);
  const severity = useDashboardStore((s) => s.severity);
  const signalType = useDashboardStore((s) => s.signalType);
  const setRange = useDashboardStore((s) => s.setRange);
  const setSeverity = useDashboardStore((s) => s.setSeverity);
  const setSignalType = useDashboardStore((s) => s.setSignalType);

  // Recomputed only when the preset changes: a fresh `now` on every render
  // would produce a new query key each time and re-fetch forever.
  const window = useMemo(() => presetToWindow(range), [range]);

  const summaryQuery = useAnalyticsSummary(window, {
    refetchInterval: ANALYTICS_POLL_MS,
  });

  // No window — the scorecard's counters are cumulative, not period aggregates.
  const suppliersQuery = useSupplierScorecard(
    { limit: 50 },
    { refetchInterval: ANALYTICS_POLL_MS }
  );

  const anomalyFilters = useMemo(
    () => ({
      ...window,
      limit: 20,
      severity: severity === ANOMALY_FILTER_ALL ? undefined : severity,
      signalType: signalType === ANOMALY_FILTER_ALL ? undefined : signalType,
    }),
    [window, severity, signalType]
  );

  const anomaliesQuery = useInfiniteAnomalies(anomalyFilters);
  const anomalies = anomaliesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    // Window + filters
    range,
    setRange,
    severity,
    setSeverity,
    signalType,
    setSignalType,

    // Summary
    summary: summaryQuery.data,
    isSummaryLoading: summaryQuery.isLoading,
    summaryError: summaryQuery.isError ? summaryQuery.error : null,
    refetchSummary: summaryQuery.refetch,

    // Supplier scorecard
    suppliers: suppliersQuery.data ?? [],
    isSuppliersLoading: suppliersQuery.isLoading,
    suppliersError: suppliersQuery.isError ? suppliersQuery.error : null,

    // Anomaly feed
    anomalies,
    isAnomaliesLoading: anomaliesQuery.isLoading,
    anomaliesError: anomaliesQuery.isError ? anomaliesQuery.error : null,
    hasMoreAnomalies: Boolean(anomaliesQuery.hasNextPage),
    fetchMoreAnomalies: anomaliesQuery.fetchNextPage,
    isFetchingMoreAnomalies: anomaliesQuery.isFetchingNextPage,
  };
}
