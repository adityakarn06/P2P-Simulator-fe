"use client";

import Link from "next/link";
import { useReceiptList } from "@/hooks/use-receipt-list";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/formatters";
import type { GoodsReceiptListItem } from "@/types/models";
import type { ReceiptListTab } from "@/store/receipt-store";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, ReceiptIcon } from "@/lib/icons";

const columns: AppColumnDef<GoodsReceiptListItem>[] = [
  {
    accessorKey: "poNumber",
    header: "PO Number",
    cell: ({ row }) => (
      <span className="text-sm font-mono font-medium">{row.original.poNumber}</span>
    ),
  },
  {
    accessorKey: "id",
    header: "Receipt",
    cell: ({ row }) => (
      <span className="text-xs font-mono text-muted-foreground">
        {row.original.id.slice(0, 12)}…
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "receivedBy",
    header: "Received By",
    cell: ({ row }) => <span className="text-sm">{row.original.receivedBy}</span>,
  },
  {
    accessorKey: "receivedAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatRelativeTime(row.original.receivedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/purchase-orders/${row.original.purchaseOrderId}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

export default function ReceiptsPage() {
  const { activeTab, setActiveTab, data, isLoading, isError, error, refetch } = useReceiptList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Goods Receipts"
        description="Delivery records created by simulating a shipment's arrival."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReceiptListTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
          <TabsTrigger value="partial" className="text-xs">Partial</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={ReceiptIcon}
            title="No goods receipts found"
            description={
              activeTab === "all"
                ? "Receipts are created when a shipment's delivery is simulated."
                : `No receipts in "${activeTab}" state.`
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
