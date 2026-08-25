"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { useShipment, useSimulateReceipt } from "@/hooks/use-shipments";
import {
  buildFlatReceiptBody,
  canSimulateDelivery,
  isQuantityConflict,
  parseReceiptConflict,
  validateReceiptForm,
  type ReceiptConflict,
} from "@/lib/state/shipment-state";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/types/api";
import type { PurchaseOrder, PurchaseOrderItem } from "@/types/models";

/**
 * Shared toast copy for a failed simulate-delivery mutation, mirroring
 * poErrorToastMessage in use-purchase-order-actions.ts so the same error
 * kinds read the same way across the workflow.
 */
function receiptErrorToastMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (isQuantityConflict(e)) {
      return "A delivery was already recorded with different quantities.";
    }
    if (e.isConflict) return "This shipment can no longer be received — refreshed.";
    if (e.isNotFound) return "This shipment no longer exists.";
  }
  return getErrorMessage(e);
}

/**
 * Resolves the shipment id from the purchase order, fetches the shipment +
 * goods receipt, and owns the simulate-delivery dialog: form fields, field
 * errors, the conflict panel, and the mutation.
 *
 * Dialog state is local — ephemeral, single-consumer UI state with no
 * cross-component readers, same rationale as usePurchaseOrderActions.
 */
export function useShipmentSection(
  requisitionId: string,
  purchaseOrder: Pick<PurchaseOrder, "id"> & { items: Pick<PurchaseOrderItem, "quantity">[] }
) {
  const poDetail = usePurchaseOrder(purchaseOrder.id);
  const shipmentId = poDetail.data?.shipment?.id ?? "";

  const shipment = useShipment(shipmentId, { enabled: Boolean(shipmentId) });
  const simulate = useSimulateReceipt();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [damagedQuantity, setDamagedQuantity] = useState("0");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ReceiptConflict | null>(null);

  const orderedQuantity = purchaseOrder.items[0]?.quantity ?? 0;

  const actionsDisabled = simulate.isPending || simulate.isSuccess;

  const canSimulate = shipment.data
    ? canSimulateDelivery({
        shipmentStatus: shipment.data.shipment.status,
        hasGoodsReceipt: shipment.data.goodsReceipt != null,
        poItemCount: purchaseOrder.items.length,
      })
    : false;

  const openDialog = () => {
    setReceivedQuantity(orderedQuantity > 0 ? String(orderedQuantity) : "");
    setDamagedQuantity("0");
    setNotes("");
    setFieldErrors({});
    setConflict(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFieldErrors({});
    setConflict(null);
    simulate.reset();
  };

  const onDialogChange = (open: boolean) => {
    if (!open) {
      closeDialog();
    } else {
      setDialogOpen(true);
    }
  };

  const handleReceivedQuantityChange = (value: string) => {
    setReceivedQuantity(value);
    setFieldErrors((prev) => ({ ...prev, receivedQuantity: "" }));
  };

  const handleDamagedQuantityChange = (value: string) => {
    setDamagedQuantity(value);
    setFieldErrors((prev) => ({ ...prev, damagedQuantity: "" }));
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
  };

  const handleSimulateDelivery = () => {
    if (actionsDisabled || !shipmentId) return;

    const result = validateReceiptForm(
      { receivedQuantity, damagedQuantity, notes },
      orderedQuantity
    );
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    setConflict(null);

    simulate.mutate(
      {
        body: buildFlatReceiptBody(shipmentId, result.values),
        requisitionId,
        purchaseOrderId: purchaseOrder.id,
      },
      {
        onSuccess: () => {
          toast.success("Delivery recorded");
          closeDialog();
        },
        onError: (e) => {
          if (e instanceof ApiError && isQuantityConflict(e)) {
            // Keep the dialog open — show recorded vs submitted rather than
            // silently accepting or overwriting the receipt on file.
            setConflict(parseReceiptConflict(e.details));
            toast.error(receiptErrorToastMessage(e));
            return;
          }
          if (e instanceof ApiError && (e.isConflict || e.isNotFound)) {
            toast.error(receiptErrorToastMessage(e));
            closeDialog();
            return;
          }
          // Validation errors stay inline in the dialog (InlineError below) —
          // no toast, to avoid double-reporting the same message.
          if (!(e instanceof ApiError && e.isValidation)) {
            toast.error(receiptErrorToastMessage(e));
          }
        },
      }
    );
  };

  return {
    poDetail,
    shipment,
    simulate,
    canSimulate,
    orderedQuantity,
    dialogOpen,
    openDialog,
    onDialogChange,
    receivedQuantity,
    damagedQuantity,
    notes,
    setReceivedQuantity: handleReceivedQuantityChange,
    setDamagedQuantity: handleDamagedQuantityChange,
    setNotes: handleNotesChange,
    fieldErrors,
    conflict,
    actionsDisabled,
    handleSimulateDelivery,
  };
}
