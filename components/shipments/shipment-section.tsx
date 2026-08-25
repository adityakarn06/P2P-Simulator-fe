"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError } from "@/components/common/error-state";
import { SkeletonLines } from "@/components/common/loading-state";
import { EmptyState } from "@/components/common/empty-state";
import { Callout } from "@/components/common/callout";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { IN_TRANSIT_MESSAGE, isInTransit, isDelivered } from "@/lib/state/shipment-state";
import { useShipmentSection } from "@/hooks/use-shipment-section";
import { SimulateDeliveryDialog } from "@/components/shipments/simulate-delivery-dialog";
import { GoodsReceiptSummary } from "@/components/shipments/goods-receipt-summary";
import { PackageIcon } from "@/lib/icons";
import type { PurchaseOrder } from "@/types/models";

interface ShipmentSectionProps {
  requisitionId: string;
  purchaseOrder: PurchaseOrder;
}

export function ShipmentSection({ requisitionId, purchaseOrder }: ShipmentSectionProps) {
  const {
    poDetail,
    shipment,
    simulate,
    canSimulate,
    orderedQuantity,
    dialogOpen,
    openDialog,
    onDialogChange,
    receivedQuantity,
    setReceivedQuantity,
    damagedQuantity,
    setDamagedQuantity,
    dialogItems,
    setItemReceivedQuantity,
    setItemDamagedQuantity,
    notes,
    setNotes,
    fieldErrors,
    conflict,
    actionsDisabled,
    handleSimulateDelivery,
  } = useShipmentSection(requisitionId, purchaseOrder);

  if (poDetail.isLoading) {
    return <SkeletonLines />;
  }

  if (poDetail.isError) {
    return <InlineError error={poDetail.error} />;
  }

  if (!poDetail.data?.shipment) {
    return (
      <EmptyState
        icon={PackageIcon}
        title="No shipment yet"
        description="A shipment is created automatically once the purchase order is approved."
        className="p-6"
      />
    );
  }

  if (shipment.isLoading) {
    return <SkeletonLines />;
  }

  if (shipment.isError) {
    return <InlineError error={shipment.error} />;
  }

  if (!shipment.data) {
    return null;
  }

  const { shipment: s, goodsReceipt } = shipment.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{s.trackingNumber}</p>
          <p className="text-xs text-muted-foreground">Carrier: {s.carrier ?? "—"}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Shipped</p>
          <p className="text-sm">{s.shippedAt ? formatDate(s.shippedAt) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expected delivery</p>
          <p className="text-sm">{formatDate(s.expectedDeliveryDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Delivered</p>
          <p className="text-sm">{s.deliveredAt ? formatDateTime(s.deliveredAt) : "—"}</p>
        </div>
      </div>

      {isInTransit(s) && (
        <Callout tone="progress">
          <p className="font-medium text-foreground">{IN_TRANSIT_MESSAGE}</p>
          {canSimulate && (
            <div className="pt-2">
              <Button disabled={actionsDisabled} onClick={openDialog} className="gap-1.5">
                Simulate Delivery
              </Button>
            </div>
          )}
        </Callout>
      )}

      {isDelivered(s) && goodsReceipt && (
        <GoodsReceiptSummary goodsReceipt={goodsReceipt} poItems={purchaseOrder.items} />
      )}

      <SimulateDeliveryDialog
        open={dialogOpen}
        onOpenChange={onDialogChange}
        orderedQuantity={orderedQuantity}
        receivedQuantity={receivedQuantity}
        onReceivedQuantityChange={setReceivedQuantity}
        damagedQuantity={damagedQuantity}
        onDamagedQuantityChange={setDamagedQuantity}
        items={dialogItems}
        onItemReceivedQuantityChange={setItemReceivedQuantity}
        onItemDamagedQuantityChange={setItemDamagedQuantity}
        notes={notes}
        onNotesChange={setNotes}
        fieldErrors={fieldErrors}
        conflict={conflict}
        isPending={simulate.isPending}
        error={simulate.error}
        onConfirm={handleSimulateDelivery}
      />
    </div>
  );
}
