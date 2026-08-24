"use client";

import { useState } from "react";
import Link from "next/link";

import { useRequisitions } from "@/hooks/use-requisitions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { DataTable, type AppColumnDef } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/formatters";
import type { RequisitionListItem, RequisitionStatus } from "@/types/models";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  FileEditIcon,
  Add01Icon,
} from "@/lib/icons";

type TabFilter = "all" | "processing" | "needs_clarification" | "completed" | "failed";

const TAB_STATUS_MAP: Record<TabFilter, RequisitionStatus | undefined> = {
  all: undefined,
  processing: "PROCESSING",
  needs_clarification: "NEEDS_CLARIFICATION",
  completed: "PO_CREATED",
  failed: "FAILED",
};

const columns: AppColumnDef<RequisitionListItem>[] = [
  {
    accessorKey: "rawInput",
    header: "Description",
    cell: ({ row }) => (
      <Link
        href={`/requisitions/${row.original.id}`}
        className="block max-w-sm truncate text-sm font-medium hover:underline"
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
    accessorKey: "turnCount",
    header: "Turns",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.original.turnCount}
      </span>
    ),
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
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.updatedAt)}
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

export default function RequisitionsPage() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const status = TAB_STATUS_MAP[activeTab];

  const { data, isLoading, isError, error, refetch } = useRequisitions(
    status ? { status, limit: 50 } : { limit: 50 }
  );

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Requisitions"
        description="Start procurements via chat. AI extracts requirements and finds the best supplier."
        actions={
          <Link href="/requisitions/new" className={buttonVariants({ size: "sm" })}>
            <HugeiconsIcon icon={Add01Icon} className="mr-1 size-3.5" />
            New Requisition
          </Link>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="processing" className="text-xs">Processing</TabsTrigger>
          <TabsTrigger value="needs_clarification" className="text-xs">Needs Clarification</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">PO Created</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={FileEditIcon}
            title="No requisitions found"
            description={
              activeTab === "all"
                ? "Create your first requisition to start a procurement workflow."
                : `No requisitions in "${activeTab}" state.`
            }
            className="py-12"
          />
        }
      />

      {data?.nextCursor && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Showing first 50 results.
        </p>
      )}
    </div>
  );
}
