"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PurchaseOrderSection } from "@/components/purchase-orders/purchase-order-section";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { PackageIcon, ArrowRight01Icon } from "@/lib/icons";

interface PurchaseOrderDetailProps {
  id: string;
}

/**
 * /purchase-orders/[id]. GET /purchase-orders/:id returns
 * { purchaseOrder, shipment }, so both the approval UI and the shipment
 * summary come from a single fetch — no second request needed.
 */
export function PurchaseOrderDetail({ id }: PurchaseOrderDetailProps) {
  const { data, isLoading, isError, error, refetch } = usePurchaseOrder(id);

  if (isLoading) {
    return <LoadingState message="Loading purchase order…" className="flex-1" />;
  }

  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const { purchaseOrder, shipment } = data;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title={purchaseOrder.poNumber}
        description="View approval status, line items, and shipment for this purchase order."
        actions={
          <Link
            href={`/requisitions/${purchaseOrder.requisitionId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View requisition
          </Link>
        }
      />

      <PurchaseOrderSection
        requisitionId={purchaseOrder.requisitionId}
        purchaseOrder={purchaseOrder}
      />

      {shipment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={PackageIcon} className="size-4" />
              Shipment
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Tracking #</p>
              <p className="text-sm font-mono">{shipment.trackingNumber}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={shipment.status} />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Shipped</p>
              <p className="text-sm">
                {shipment.shippedAt ? formatDateTime(shipment.shippedAt) : "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {shipment.deliveredAt ? "Delivered" : "Expected delivery"}
              </p>
              <p className="text-sm">
                {shipment.deliveredAt
                  ? formatDateTime(shipment.deliveredAt)
                  : formatDate(shipment.expectedDeliveryDate)}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <Link
                href="/shipments"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                View in shipments
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
