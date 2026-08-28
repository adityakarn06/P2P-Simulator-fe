"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequisitions } from "@/hooks/use-requisitions";
import { useExceptions } from "@/hooks/use-exceptions";
import { useDashboard } from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { KpiTile } from "@/components/analytics/kpi-tile";
import { AnalyticsCard } from "@/components/analytics/analytics-card";
import { DateRangeSelect } from "@/components/analytics/date-range-select";
import { FunnelChart } from "@/components/analytics/funnel-chart";
import { CycleTimeChart } from "@/components/analytics/cycle-time-chart";
import { ExceptionBreakdownChart } from "@/components/analytics/exception-breakdown-chart";
import { SupplierSpendChart } from "@/components/analytics/supplier-spend-chart";
import { SupplierScorecardTable } from "@/components/analytics/supplier-scorecard-table";
import { AnomalyFeed } from "@/components/analytics/anomaly-feed";
import {
  formatDuration,
  formatCount,
  summarizeAutomation,
  toAiJobRows,
  toCycleTimeChartData,
  type FunnelStage,
} from "@/lib/state/analytics-state";
import { formatRelativeTime } from "@/lib/formatters";
import type { RequisitionListItem, Exception } from "@/types/models";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, FileEditIcon as ReqIcon } from "@/lib/icons";

/**
 * The P2P analytics dashboard.
 *
 * Every figure here comes from GET /analytics/summary, /suppliers and
 * /anomalies. Nothing is derived from paging through list endpoints, and
 * nothing is estimated client-side — an earlier version of this screen
 * fabricated week-over-week trends from whatever page of records it happened
 * to have, which is exactly the kind of number a dashboard must not invent.
 */

// ── Recent requisitions columns ──────────────────────────────────────────────

const reqColumns: AppColumnDef<RequisitionListItem>[] = [
  {
    accessorKey: "rawInput",
    header: "Description",
    cell: ({ row }) => (
      <Link
        href={`/requisitions/${row.original.id}`}
        className="block max-w-xs truncate text-sm font-medium hover:underline"
        title={row.original.rawInput}
      >
        {row.original.rawInput}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/requisitions/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

// ── Open exceptions columns ──────────────────────────────────────────────────

const excColumns: AppColumnDef<Exception>[] = [
  {
    accessorKey: "title",
    header: "Exception",
    cell: ({ row }) => (
      <Link
        href={`/exceptions/${row.original.id}`}
        className="block max-w-xs truncate text-sm font-medium hover:underline"
        title={row.original.title}
      >
        {row.original.title}
      </Link>
    ),
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <StatusBadge status={row.original.severity} />,
  },
  {
    accessorKey: "createdAt",
    header: "Raised",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.createdAt)}
      </span>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [funnelStage, setFunnelStage] = useState<FunnelStage>("requisitions");

  const {
    range,
    setRange,
    severity,
    setSeverity,
    signalType,
    setSignalType,
    summary,
    isSummaryLoading,
    summaryError,
    refetchSummary,
    suppliers,
    isSuppliersLoading,
    anomalies,
    isAnomaliesLoading,
    hasMoreAnomalies,
    fetchMoreAnomalies,
    isFetchingMoreAnomalies,
  } = useDashboard();

  // Small, capped fetches for the "recent" tables at the bottom.
  const { data: reqs, isLoading: loadingReqs } = useRequisitions({ limit: 5 });
  const { data: openExc, isLoading: loadingExc } = useExceptions({
    status: "OPEN",
    limit: 5,
  });
  const recentReqs = useMemo(() => reqs?.items.slice(0, 5) ?? [], [reqs]);

  const automation = summary ? summarizeAutomation(summary.automation) : null;
  const aiRows = toAiJobRows(summary?.ai);
  const cycleRows = summary ? toCycleTimeChartData(summary.cycleTimes) : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Dashboard"
        description="Procure-to-Pay analytics across the whole pipeline."
        actions={
          <div className="flex items-center gap-2">
            <DateRangeSelect value={range} onChange={setRange} />
            <Link href="/requisitions/new" className={buttonVariants({ size: "sm" })}>
              New Requisition
            </Link>
          </div>
        }
      />

      {summaryError ? (
        <ErrorState error={summaryError} onRetry={() => refetchSummary()} />
      ) : (
        <>
          {/* ── KPI row ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Touchless invoices"
              value={automation?.touchlessRate ?? "—"}
              basis={automation?.touchlessBasis}
              note="Invoice-side only. Purchase-order approval is deliberately a human step in this build, so an end-to-end touchless figure would be 0 by construction and would say nothing about the automation. An exception that was raised and later resolved still disqualifies an invoice — a human touched it."
              href="/invoices"
              isLoading={isSummaryLoading}
            />
            <KpiTile
              label="First-pass match rate"
              value={automation?.firstPassMatchRate ?? "—"}
              basis={
                automation
                  ? `${automation.invoicesRequiringReview} paid after human review`
                  : undefined
              }
              note="Three-way matches that came back MATCHED on the first run, over all matches run."
              isLoading={isSummaryLoading}
            />
            <KpiTile
              label="Open exceptions"
              value={formatCount(summary?.exceptions.openTotal)}
              basis={
                summary?.exceptions.meanResolutionHours != null
                  ? `${formatDuration(summary.exceptions.meanResolutionHours)} mean to resolve`
                  : "Nothing resolved yet"
              }
              href="/exceptions"
              isLoading={isSummaryLoading}
            />
            <KpiTile
              label="Committed spend"
              value={
                summary ? <Money paise={summary.spend.committed.paise} compact /> : "—"
              }
              basis={
                summary
                  ? `${summary.spend.paid.display} paid · ${summary.spend.blocked.display} blocked`
                  : undefined
              }
              note="Committed covers every non-rejected purchase order. Blocked is payment held behind an open exception."
              href="/purchase-orders"
              isLoading={isSummaryLoading}
            />
          </div>

          {/* ── Funnel ─────────────────────────────────────────────────── */}
          <AnalyticsCard
            title="Pipeline funnel"
            caption="Records at each stage, and the status breakdown within the selected one. Generated invoices — the convenience PDFs this system renders from a PO — are excluded server-side; counting them as invoices received would double the funnel."
            isLoading={isSummaryLoading}
          >
            {summary && (
              <FunnelChart
                funnel={summary.funnel}
                stage={funnelStage}
                onStageChange={setFunnelStage}
              />
            )}
          </AnalyticsCard>

          {/* ── Cycle times ───────────────────────────────────────────── */}
          <AnalyticsCard
            title="Cycle times"
            caption="Median first — procurement durations are skewed, and one requisition left over a weekend drags a mean somewhere no buyer recognises. A flow that has not finished contributes nothing rather than counting as instant, so stages differ in how many completions they are measured over."
            isLoading={isSummaryLoading}
            isEmpty={!isSummaryLoading && cycleRows.length === 0}
            emptyMessage="No flow has completed a stage yet."
          >
            {summary && <CycleTimeChart cycleTimes={summary.cycleTimes} />}
          </AnalyticsCard>

          {/* ── Exceptions + spend ────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnalyticsCard
              title="Exceptions by type"
              caption="Open counts both OPEN and UNDER_REVIEW — the split is workflow detail a summary does not need."
              isLoading={isSummaryLoading}
              isEmpty={!isSummaryLoading && (summary?.exceptions.byType.length ?? 0) === 0}
              emptyMessage="No exceptions raised."
            >
              {summary && <ExceptionBreakdownChart exceptions={summary.exceptions} />}
            </AnalyticsCard>

            <AnalyticsCard
              title="Spend by supplier"
              caption="Top suppliers by committed value across every non-rejected purchase order."
              isLoading={isSummaryLoading}
              isEmpty={!isSummaryLoading && (summary?.spend.topSuppliers.length ?? 0) === 0}
              emptyMessage="No committed spend yet."
            >
              {summary && <SupplierSpendChart topSuppliers={summary.spend.topSuppliers} />}
            </AnalyticsCard>
          </div>

          {/* ── Supplier scorecard ────────────────────────────────────── */}
          <AnalyticsCard
            title="Supplier scorecard"
            caption="Reliability carries real weight in supplier selection, so this table shows why the next requisition will pick who it picks. OTIF is on-time × in-full, an approximation — the stored counters do not record which deliveries were both. A supplier that has never delivered shows — rather than 0%."
            isLoading={isSuppliersLoading}
          >
            <SupplierScorecardTable suppliers={suppliers} isLoading={isSuppliersLoading} />
          </AnalyticsCard>

          {/* ── Anomaly feed ──────────────────────────────────────────── */}
          <AnalyticsCard
            title="Anomaly signals"
            caption="Advisory only — a signal never blocks a payment, raises an exception, or changes a match verdict. These are deterministic statistics over this organization's own history, not a model, and each ships with the sentence that explains it."
          >
            <AnomalyFeed
              signals={anomalies}
              isLoading={isAnomaliesLoading}
              severity={severity}
              onSeverityChange={setSeverity}
              signalType={signalType}
              onSignalTypeChange={setSignalType}
              hasMore={hasMoreAnomalies}
              onLoadMore={() => fetchMoreAnomalies()}
              isLoadingMore={isFetchingMoreAnomalies}
            />
          </AnalyticsCard>

          {/* ── AI latency ────────────────────────────────────────────── */}
          {aiRows.length > 0 && (
            <AnalyticsCard
              title="AI processing"
              caption="Per job type. The latency percentiles are what tell you whether the model calls are why the workflow feels slow."
              isLoading={isSummaryLoading}
            >
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {aiRows.map((job) => (
                  <div key={job.jobType}>
                    <dt className="truncate text-xs text-muted-foreground">{job.label}</dt>
                    <dd className="mt-0.5 text-sm tabular-nums">
                      {job.p50} <span className="text-muted-foreground">p50</span>
                    </dd>
                    <dd className="text-xs text-muted-foreground tabular-nums">
                      {job.p95} p95 · {job.successRate} success · {job.runs} runs
                    </dd>
                  </div>
                ))}
              </dl>
            </AnalyticsCard>
          )}
        </>
      )}

      {/* ── Recent requisitions ─────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent Requisitions</h2>
          <Link href="/requisitions" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all
            <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-3.5" />
          </Link>
        </div>
        <DataTable
          columns={reqColumns}
          data={recentReqs}
          isLoading={loadingReqs}
          skeletonRows={5}
          emptyState={
            <EmptyState
              title="No requisitions yet"
              description="Start by creating your first procurement requisition."
              className="py-8"
              action={{
                label: "New Requisition",
                onClick: () => router.push("/requisitions/new"),
                icon: ReqIcon,
              }}
            />
          }
        />
      </section>

      {/* ── Open exceptions ─────────────────────────────────────────── */}
      {(loadingExc || (openExc?.items.length ?? 0) > 0) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              Open Exceptions
            </h2>
            <Link href="/exceptions" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-3.5" />
            </Link>
          </div>
          <DataTable
            columns={excColumns}
            data={openExc?.items ?? []}
            isLoading={loadingExc}
            skeletonRows={3}
          />
        </section>
      )}
    </div>
  );
}
