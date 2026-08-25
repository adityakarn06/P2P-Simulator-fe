"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { useShipment, useSimulateReceipt } from "@/hooks/use-shipments";
import type { SimulateReceiptBody } from "@/lib/api/receipts";
import {
  buildFlatReceiptBody,
  buildExplicitReceiptBody,
  canSimulateDelivery,
  isQuantityConflict,
  parseReceiptConflict,
  validateReceiptForm,
  validateMultiLineReceiptForm,
  type ReceiptConflict,
  type MultiLineReceiptRawItem,
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
  purchaseOrder: Pick<PurchaseOrder, "id"> & {
    items: Pick<PurchaseOrderItem, "id" | "description" | "quantity">[];
  }
) {
  const poDetail = usePurchaseOrder(purchaseOrder.id);
  const shipmentId = poDetail.data?.shipment?.id ?? "";

  const shipment = useShipment(shipmentId, { enabled: Boolean(shipmentId) });
  const simulate = useSimulateReceipt();

  const multiLine = purchaseOrder.items.length > 1;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [damagedQuantity, setDamagedQuantity] = useState("0");
  const [lineItems, setLineItems] = useState<MultiLineReceiptRawItem[]>([]);
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<ReceiptConflict | null>(null);
  const [pendingReceiptBody, setPendingReceiptBody] = useState<
    SimulateReceiptBody | null
  >(null);

  const orderedQuantity = purchaseOrder.items[0]?.quantity ?? 0;

  const animating = pendingReceiptBody != null;
  const actionsDisabled = simulate.isPending || simulate.isSuccess || animating;

  const canSimulate = shipment.data
    ? canSimulateDelivery({
        shipmentStatus: shipment.data.shipment.status,
        hasGoodsReceipt: shipment.data.goodsReceipt != null,
        poItemCount: purchaseOrder.items.length,
      })
    : false;

  const openDialog = () => {
    if (multiLine) {
      setLineItems(
        purchaseOrder.items.map((item) => ({
          purchaseOrderItemId: item.id,
          receivedQuantity: item.quantity > 0 ? String(item.quantity) : "",
          damagedQuantity: "0",
        }))
      );
    } else {
      setReceivedQuantity(orderedQuantity > 0 ? String(orderedQuantity) : "");
      setDamagedQuantity("0");
    }
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

  const handleItemReceivedQuantityChange = (purchaseOrderItemId: string, value: string) => {
    const index = lineItems.findIndex((item) => item.purchaseOrderItemId === purchaseOrderItemId);
    setLineItems((prev) =>
      prev.map((item) =>
        item.purchaseOrderItemId === purchaseOrderItemId
          ? { ...item, receivedQuantity: value }
          : item
      )
    );
    setFieldErrors((prev) => ({
      ...prev,
      [`items.${index}.receivedQuantity`]: "",
      items: "",
    }));
  };

  const handleItemDamagedQuantityChange = (purchaseOrderItemId: string, value: string) => {
    const index = lineItems.findIndex((item) => item.purchaseOrderItemId === purchaseOrderItemId);
    setLineItems((prev) =>
      prev.map((item) =>
        item.purchaseOrderItemId === purchaseOrderItemId
          ? { ...item, damagedQuantity: value }
          : item
      )
    );
    setFieldErrors((prev) => ({ ...prev, [`items.${index}.damagedQuantity`]: "" }));
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
  };

  /**
   * Fires the real POST /receipts/simulate mutation. Shared by the
   * no-map fallback (mapbox token absent) and handleAnimationComplete
   * (map present — this runs once the truck reaches Kolkata).
   */
  const submitReceipt = (body: SimulateReceiptBody) => {
    simulate.mutate(
      {
        body,
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

  const handleSimulateDelivery = () => {
    if (actionsDisabled || !shipmentId) return;

    const body = multiLine
      ? (() => {
          const result = validateMultiLineReceiptForm(
            { items: lineItems, notes },
            purchaseOrder.items
          );
          if (!result.ok) {
            setFieldErrors(result.errors);
            return null;
          }
          return buildExplicitReceiptBody(shipmentId, result.values);
        })()
      : (() => {
          const result = validateReceiptForm(
            { receivedQuantity, damagedQuantity, notes },
            orderedQuantity
          );
          if (!result.ok) {
            setFieldErrors(result.errors);
            return null;
          }
          return buildFlatReceiptBody(shipmentId, result.values);
        })();

    if (!body) return;
    setFieldErrors({});
    setConflict(null);

    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      // No map available — record the delivery immediately, same as before
      // the animation existed.
      submitReceipt(body);
      return;
    }

    // Hold the dialog's mutation until the truck arrives: close the dialog,
    // show the map animation, and submit only once it fires onArrive.
    setDialogOpen(false);
    setPendingReceiptBody(body);
  };

  const handleAnimationComplete = () => {
    if (!pendingReceiptBody) return;
    const body = pendingReceiptBody;
    setPendingReceiptBody(null);
    submitReceipt(body);
  };

  const dialogItems = multiLine
    ? lineItems.map((raw) => {
        const poItem = purchaseOrder.items.find((p) => p.id === raw.purchaseOrderItemId);
        return {
          purchaseOrderItemId: raw.purchaseOrderItemId,
          description: poItem?.description ?? raw.purchaseOrderItemId,
          orderedQuantity: poItem?.quantity ?? 0,
          receivedQuantity: raw.receivedQuantity,
          damagedQuantity: raw.damagedQuantity,
        };
      })
    : undefined;

  return {
    poDetail,
    shipment,
    simulate,
    canSimulate,
    multiLine,
    orderedQuantity,
    dialogOpen,
    openDialog,
    onDialogChange,
    receivedQuantity,
    damagedQuantity,
    dialogItems,
    setReceivedQuantity: handleReceivedQuantityChange,
    setDamagedQuantity: handleDamagedQuantityChange,
    setItemReceivedQuantity: handleItemReceivedQuantityChange,
    setItemDamagedQuantity: handleItemDamagedQuantityChange,
    notes,
    setNotes: handleNotesChange,
    fieldErrors,
    conflict,
    actionsDisabled,
    handleSimulateDelivery,
    animating,
    handleAnimationComplete,
  };
}
