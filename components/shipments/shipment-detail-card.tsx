"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonLines } from "@/components/common/loading-state";
import { GoodsReceiptSummary } from "@/components/shipments/goods-receipt-summary";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { useShipment } from "@/hooks/use-shipments";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { buttonVariants } from "@/components/ui/button";
import { PackageIcon, ArrowRight01Icon } from "@/lib/icons";
import type { ShipmentListItem } from "@/types/models";

interface ShipmentDetailCardProps {
  shipmentListItem: ShipmentListItem | undefined;
}

/**
 * Right-hand pane of the /shipments master-detail layout. Fed by
 * GET /shipments/:id (the same query the PO detail page uses), so tracking,
 * timeline, and the goods-receipt line-item breakdown are always live data —
 * never derived from the list row, which carries no items[].
 */
export function ShipmentDetailCard({ shipmentListItem }: ShipmentDetailCardProps) {
  const shipment = useShipment(shipmentListItem?.id ?? "", {
    enabled: Boolean(shipmentListItem?.id),
  });
  // Only needed for goods-receipt line-item descriptions — the list row and
  // GET /shipments/:id both omit purchaseOrder.items.
  const purchaseOrder = usePurchaseOrder(shipmentListItem?.purchaseOrderId ?? "", {
    enabled: Boolean(shipmentListItem?.purchaseOrderId && shipment.data?.goodsReceipt),
  });

  if (!shipmentListItem) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center">
          <EmptyState
            icon={PackageIcon}
            title="No shipment selected"
            description="Select a row on the left to see tracking and goods receipt detail."
            className="p-6"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-0.5">
          <CardTitle>{shipmentListItem.poNumber}</CardTitle>
          <p className="text-xs text-muted-foreground">{shipmentListItem.trackingNumber}</p>
        </div>
        <Link
          href={`/purchase-orders/${shipmentListItem.purchaseOrderId}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          View PO
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {shipment.isLoading && <SkeletonLines />}

        {shipment.isError && <InlineError error={shipment.error} />}

        {shipment.data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Carrier</p>
                <p className="text-sm">{shipment.data.shipment.carrier ?? "—"}</p>
              </div>
              <StatusBadge status={shipment.data.shipment.status} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Shipped</p>
                <p className="text-sm">
                  {shipment.data.shipment.shippedAt
                    ? formatDate(shipment.data.shipment.shippedAt)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expected</p>
                <p className="text-sm">{formatDate(shipment.data.shipment.expectedDeliveryDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-sm">
                  {shipment.data.shipment.deliveredAt
                    ? formatDateTime(shipment.data.shipment.deliveredAt)
                    : "—"}
                </p>
              </div>
            </div>

            {shipment.data.goodsReceipt ? (
              <GoodsReceiptSummary
                goodsReceipt={shipment.data.goodsReceipt}
                poItems={purchaseOrder.data?.purchaseOrder.items ?? []}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No goods receipt yet — this shipment hasn&apos;t been delivered.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
