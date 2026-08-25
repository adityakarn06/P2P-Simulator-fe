"use client";

import Link from "next/link";
import { useShipmentList } from "@/hooks/use-shipment-list";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ShipmentDetailCard } from "@/components/shipments/shipment-detail-card";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatRelativeTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ShipmentListItem } from "@/types/models";
import type { ShipmentListTab } from "@/store/shipment-store";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, PackageIcon } from "@/lib/icons";

const columns: AppColumnDef<ShipmentListItem>[] = [
    {
      accessorKey: "poNumber",
      header: "PO Number",
      cell: ({ row }) => (
        <span className="text-sm font-mono font-medium">{row.original.poNumber}</span>
      ),
    },
    {
      accessorKey: "trackingNumber",
      header: "Tracking",
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.original.trackingNumber}
        </span>
      ),
    },
    {
      accessorKey: "carrier",
      header: "Carrier",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.carrier ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "shippedAt",
      header: "Shipped",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.original.shippedAt ? formatRelativeTime(row.original.shippedAt) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "expectedDeliveryDate",
      header: "Expected",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDate(row.original.expectedDeliveryDate)}
        </span>
      ),
    },
    {
      accessorKey: "deliveredAt",
      header: "Delivered",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.original.deliveredAt ? formatDate(row.original.deliveredAt) : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Link
          href={`/purchase-orders/${row.original.purchaseOrderId}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          onClick={(e) => e.stopPropagation()}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      ),
    },
];

export default function ShipmentsPage() {
  const {
    activeTab,
    setActiveTab,
    selectedShipmentId,
    setSelectedShipmentId,
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useShipmentList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const selectedShipment = data?.items.find((item) => item.id === selectedShipmentId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Shipments"
        description="Track inbound shipments and goods receipt for open purchase orders."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ShipmentListTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="created" className="text-xs">Created</TabsTrigger>
          <TabsTrigger value="in_transit" className="text-xs">In Transit</TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs">Delivered</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          skeletonRows={8}
          onRowClick={(row) => setSelectedShipmentId(row.id)}
          rowClassName={(row) =>
            row.id === selectedShipmentId ? "bg-muted/50" : undefined
          }
          emptyState={
            <EmptyState
              icon={PackageIcon}
              title="No shipments found"
              description={
                activeTab === "all"
                  ? "Shipments are created automatically once a purchase order is approved."
                  : `No shipments in "${activeTab.replace("_", " ")}" state.`
              }
              className="py-12"
            />
          }
        />

        <div className={cn("lg:sticky lg:top-4")}>
          <ShipmentDetailCard shipmentListItem={selectedShipment} />
        </div>
      </div>

      {data?.nextCursor && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Showing first 50 results.
        </p>
      )}
    </div>
  );
}
