"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequisitions } from "@/hooks/use-requisitions";
import { useExceptions } from "@/hooks/use-exceptions";
import { useInvoices } from "@/hooks/use-invoices";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { RequisitionListItem, Exception } from "@/types/models";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { PlusCircle, ShoppingCart } from "lucide-react";
import {
  FileEditIcon,
  ShoppingCart01Icon,
  Invoice01Icon,
  Alert01Icon,
  ArrowRight01Icon,
  FileEditIcon as ReqIcon,
} from "@/lib/icons";

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  href: string;
  icon: IconSvgElement;
  iconClass: string;
  highlight?: boolean;
}

function StatCard({ label, value, isLoading, href, icon, iconClass, highlight }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/40",
        highlight && "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("rounded-md p-1.5", iconClass)}>
          <HugeiconsIcon icon={icon} className="size-4" />
        </div>
        <span className="text-sm text-muted-foreground truncate">{label}</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-8" />
      ) : (
        <span className={cn("text-sm font-semibold tabular-nums", highlight && "text-orange-700 dark:text-orange-400")}>
          {value ?? "—"}
        </span>
      )}
    </Link>
  );
}

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
  const { data: reqs, isLoading: loadingReqs } = useRequisitions({ limit: 5 });
  const { data: openExc, isLoading: loadingExc } = useExceptions({ status: "OPEN", limit: 5 });
  const { data: pos, isLoading: loadingPos } = usePurchaseOrders({ limit: 1 });
  const { data: invs, isLoading: loadingInvs } = useInvoices({ limit: 1 });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-5xl">
      <PageHeader
        title="Dashboard"
        description="Procure-to-Pay lifecycle overview."
        actions={
          <Link href="/requisitions/new" className={buttonVariants({ size: "sm" })}>
            New Requisition
          </Link>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Requisitions"
          value={reqs?.items.length}
          isLoading={loadingReqs}
          href="/requisitions"
          icon={FileEditIcon}
          iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
        />
        <StatCard
          label="Purchase Orders"
          value={pos?.items.length}
          isLoading={loadingPos}
          href="/purchase-orders"
          icon={ShoppingCart01Icon}
          iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300"
        />
        <StatCard
          label="Invoices"
          value={invs?.items.length}
          isLoading={loadingInvs}
          href="/invoices"
          icon={Invoice01Icon}
          iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300"
        />
        <StatCard
          label="Open Exceptions"
          value={openExc?.items.length}
          isLoading={loadingExc}
          href="/exceptions"
          icon={Alert01Icon}
          iconClass="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
          highlight={(openExc?.items.length ?? 0) > 0}
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
          data={reqs?.items ?? []}
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
