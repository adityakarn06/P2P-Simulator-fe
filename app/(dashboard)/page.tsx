"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequisitions } from "@/hooks/use-requisitions";
import { useExceptions } from "@/hooks/use-exceptions";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { RequisitionListItem, Exception, PurchaseOrder } from "@/types/models";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  FileEditIcon as ReqIcon,
} from "@/lib/icons";

// ── Trend helper ─────────────────────────────────────────────────────────────
// There's no historical/analytics endpoint, so trends are derived client-side
// by comparing the last 7 days against the 7 days before that, within the
// current page of results. This is a best-effort signal, not an exact stat.

type Trend = { pct: number; direction: "up" | "down" | "flat" } | null;

const DAY_MS = 24 * 60 * 60 * 1000;

function computeTrend<T>(items: T[], getCreatedAt: (item: T) => string, getValue: (item: T) => number = () => 1): Trend {
  if (items.length === 0) return null;
  const now = Date.now();
  let recent = 0;
  let previous = 0;
  for (const item of items) {
    const age = now - new Date(getCreatedAt(item)).getTime();
    if (age <= 7 * DAY_MS) recent += getValue(item);
    else if (age <= 14 * DAY_MS) previous += getValue(item);
  }
  if (previous === 0) {
    if (recent === 0) return null;
    return { pct: 100, direction: "up" };
  }
  const pct = ((recent - previous) / previous) * 100;
  if (Math.round(pct) === 0) return { pct: 0, direction: "flat" };
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: ReactNode;
  href: string;
  isLoading: boolean;
  trend: Trend;
  trendLabel?: string;
}

function StatCard({ label, value, href, isLoading, trend, trendLabel = "vs last week" }: StatCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Link
          href={href}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-300 text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/40"
          aria-label={`View ${label}`}
        >
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
      )}

      <div className="mt-2 flex items-center gap-1 text-xs">
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : trend === null || trend.direction === "flat" ? (
          <span className="text-muted-foreground">No Change</span>
        ) : (
          <>
            <HugeiconsIcon
              icon={trend.direction === "up" ? ArrowUp01Icon : ArrowDown01Icon}
              className={cn("size-3.5", trend.direction === "up" ? "text-green-600" : "text-red-500")}
            />
            <span className={cn("font-medium", trend.direction === "up" ? "text-green-600" : "text-red-500")}>
              {trend.pct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{trendLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Purchase order derived stats ─────────────────────────────────────────────

const ACTIVE_PO_STATUSES: PurchaseOrder["status"][] = [
  "PENDING_APPROVAL",
  "APPROVED",
  "SHIPPED",
  "RECEIVED",
];

// ── Recent requisitions columns ───────────────────────────────────────────────

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

// ── Open exceptions columns ───────────────────────────────────────────────────

const excColumns: AppColumnDef<Exception>[] = [
  {
    accessorKey: "title",
    header: "Exception",
    cell: ({ row }) => (
      <Link
        href={`/exceptions`}
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
  const { data: reqs, isLoading: loadingReqs } = useRequisitions({ limit: 100 });
  const { data: openExc, isLoading: loadingExc } = useExceptions({ status: "OPEN", limit: 5 });
  const { data: pos, isLoading: loadingPos } = usePurchaseOrders({ limit: 100 });

  const recentReqs = useMemo(() => reqs?.items.slice(0, 5) ?? [], [reqs]);

  const totalExpensePaise = useMemo(
    () => (pos?.items ?? []).reduce((sum, po) => (po.status === "REJECTED" ? sum : sum + po.totalPaise), 0),
    [pos]
  );
  const expenseTrend = useMemo(
    () =>
      computeTrend(
        (pos?.items ?? []).filter((po) => po.status !== "REJECTED"),
        (po) => po.createdAt,
        (po) => po.totalPaise
      ),
    [pos]
  );

  const activeOrders = useMemo(
    () => (pos?.items ?? []).filter((po) => ACTIVE_PO_STATUSES.includes(po.status)),
    [pos]
  );
  const activeOrdersTrend = useMemo(
    () => computeTrend(activeOrders, (po) => po.createdAt),
    [activeOrders]
  );

  const totalVendors = useMemo(
    () => new Set((pos?.items ?? []).map((po) => po.supplierId)).size,
    [pos]
  );

  const openForBids = useMemo(
    () => (reqs?.items ?? []).filter((req) => req.status === "REQUIREMENTS_EXTRACTED"),
    [reqs]
  );
  const openForBidsTrend = useMemo(
    () => computeTrend(openForBids, (req) => req.createdAt),
    [openForBids]
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Dashboard"
        description="Procure-to-Pay lifecycle overview."
        actions={
          <Link href="/requisitions/new" className={buttonVariants({ size: "sm" })}>
            New Requisition
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Expense"
          value={<Money paise={totalExpensePaise} compact />}
          href="/purchase-orders"
          isLoading={loadingPos}
          trend={expenseTrend}
        />
        <StatCard
          label="Active Order"
          value={String(activeOrders.length)}
          href="/purchase-orders"
          isLoading={loadingPos}
          trend={activeOrdersTrend}
        />
        <StatCard
          label="Total Vendor"
          value={String(totalVendors)}
          href="/purchase-orders"
          isLoading={loadingPos}
          trend={null}
        />
        <StatCard
          label="Open For Bids"
          value={String(openForBids.length)}
          href="/requisitions"
          isLoading={loadingReqs}
          trend={openForBidsTrend}
        />
      </div>

      {/* Recent requisitions */}
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

      {/* Open exceptions */}
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
