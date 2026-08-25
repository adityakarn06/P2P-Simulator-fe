"use client";

import { z } from "zod";
import { useApprovePurchaseOrder, useRejectPurchaseOrder } from "@/hooks/use-purchase-orders";
import { usePurchaseOrderStore } from "@/store/purchase-order-store";

// Mirrors backend-docs/purchase-orders-api.md: reason is required, 1–500 chars.
const rejectReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(500, "Reason must be 500 characters or fewer.");

/**
 * Approve/reject mutations plus the reject-dialog UI state for a single
 * purchase order. Approve/reject only render while
 * `purchaseOrder.status === "PENDING_APPROVAL"` (checked by the caller).
 */
export function usePurchaseOrderActions(requisitionId: string, purchaseOrderId: string) {
  const approve = useApprovePurchaseOrder();
  const reject = useRejectPurchaseOrder();

  const rejectDialogOpen = usePurchaseOrderStore((s) => s.rejectDialogOpenFor === purchaseOrderId);
  const openRejectDialogFor = usePurchaseOrderStore((s) => s.openRejectDialog);
  const closeRejectDialog = usePurchaseOrderStore((s) => s.closeRejectDialog);
  const rejectReason = usePurchaseOrderStore((s) => s.rejectReason);
  const setRejectReason = usePurchaseOrderStore((s) => s.setRejectReason);
  const rejectReasonError = usePurchaseOrderStore((s) => s.rejectReasonError);
  const setRejectReasonError = usePurchaseOrderStore((s) => s.setRejectReasonError);

  const openRejectDialog = () => openRejectDialogFor(purchaseOrderId);

  const onRejectDialogChange = (open: boolean) => {
    if (!open) {
      closeRejectDialog();
      reject.reset();
    } else {
      openRejectDialogFor(purchaseOrderId);
    }
  };

  const handleConfirmReject = () => {
    const result = rejectReasonSchema.safeParse(rejectReason);
    if (!result.success) {
      setRejectReasonError(result.error.issues[0]?.message ?? "Invalid reason.");
      return;
    }
    setRejectReasonError(null);
    reject.mutate(
      { id: purchaseOrderId, requisitionId, reason: result.data },
      { onSuccess: () => closeRejectDialog() }
    );
  };

  return {
    approve,
    reject,
    rejectDialogOpen,
    openRejectDialog,
    onRejectDialogChange,
    rejectReason,
    setRejectReason,
    rejectReasonError,
    handleConfirmReject,
  };
}
