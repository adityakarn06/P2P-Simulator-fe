"use client";

import Link from "next/link";
import { usePurchaseOrderList } from "@/hooks/use-purchase-order-list";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime, formatDate } from "@/lib/formatters";
import type { PurchaseOrder } from "@/types/models";
import type { PurchaseOrderListTab } from "@/store/purchase-order-store";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, ShoppingCart01Icon } from "@/lib/icons";

const columns: AppColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: "poNumber",
    header: "PO #",
    cell: ({ row }) => (
      <span className="text-sm font-mono font-medium">{row.original.poNumber}</span>
    ),
  },
  {
    accessorKey: "requisitionId",
    header: "Requisition",
    cell: ({ row }) => (
      <Link
        href={`/requisitions/${row.original.requisitionId}`}
        className="text-xs font-mono text-muted-foreground hover:underline"
      >
        {row.original.requisitionId.slice(0, 8)}…
      </Link>
    ),
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    // The list endpoint doc doesn't guarantee nested `supplier` on every row
    // — fall back gracefully rather than assuming it's always present.
    cell: ({ row }) => (
      <span className="text-sm max-w-[140px] truncate block">
        {row.original.supplier?.name ?? <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "totalPaise",
    header: "Total",
    cell: ({ row }) => <Money paise={row.original.totalPaise} className="text-sm" />,
  },
  {
    accessorKey: "expectedDeliveryDate",
    header: "Expected Delivery",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatDate(row.original.expectedDeliveryDate)}
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
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/purchase-orders/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

export default function PurchaseOrdersPage() {
  const { activeTab, setActiveTab, data, isLoading, isError, error, refetch } =
    usePurchaseOrderList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Purchase Orders"
        description="View and manage purchase orders generated from approved requisitions."
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as PurchaseOrderListTab)}
      >
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending Approval</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
          <TabsTrigger value="shipped" className="text-xs">Shipped</TabsTrigger>
          <TabsTrigger value="received" className="text-xs">Received</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={ShoppingCart01Icon}
            title="No purchase orders found"
            description={
              activeTab === "all"
                ? "Purchase orders are generated once a supplier is selected for a requisition."
                : `No purchase orders in "${activeTab}" state.`
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
