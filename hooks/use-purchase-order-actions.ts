"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApprovePurchaseOrder, useRejectPurchaseOrder } from "@/hooks/use-purchase-orders";
import { arePoActionsDisabled, validateRejectReason } from "@/lib/state/purchase-order-state";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/types/api";
import type { PurchaseOrder } from "@/types/models";

/**
 * Shared toast copy for a failed approve/reject mutation. Conflict/not-found
 * get actionable, PO-specific copy (the backend has already been
 * re-invalidated by the mutation's own onError — see use-purchase-orders.ts);
 * everything else falls back to the same categorization InlineError uses, so
 * the toast and the inline panel never disagree on the same error.
 */
function poErrorToastMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isConflict) return "This purchase order was already actioned — refreshed.";
    if (e.isNotFound) return "This purchase order no longer exists.";
  }
  return getErrorMessage(e);
}

/**
 * Approve/reject mutations plus the reject-dialog UI state for a single
 * purchase order. Approve/reject only render while
 * `purchaseOrder.status === "PENDING_APPROVAL"` (checked by the caller).
 *
 * Dialog open/reason state is local — it's ephemeral per-PO UI state with no
 * cross-component consumers, so it doesn't need Zustand. PO *status* is
 * never held here or anywhere client-side; the backend is the only source
 * of truth and every mutation success/conflict invalidates the requisition
 * + PO queries (see hooks/use-purchase-orders.ts).
 */
export function usePurchaseOrderActions(
  requisitionId: string,
  purchaseOrder: Pick<PurchaseOrder, "id" | "status">
) {
  const approve = useApprovePurchaseOrder();
  const reject = useRejectPurchaseOrder();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReasonState] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);

  const actionsDisabled = arePoActionsDisabled({
    approvePending: approve.isPending,
    rejectPending: reject.isPending,
    approveSucceeded: approve.isSuccess,
    rejectSucceeded: reject.isSuccess,
  });

  const setRejectReason = (reason: string) => {
    setRejectReasonState(reason);
    setRejectReasonError(null);
  };

  const openRejectDialog = () => setRejectDialogOpen(true);

  const closeRejectDialog = () => {
    setRejectDialogOpen(false);
    setRejectReasonState("");
    setRejectReasonError(null);
  };

  const onRejectDialogChange = (open: boolean) => {
    if (!open) {
      closeRejectDialog();
      reject.reset();
    } else {
      setRejectDialogOpen(true);
    }
  };

  const handleApprove = () => {
    if (actionsDisabled) return;
    approve.mutate(
      { id: purchaseOrder.id, requisitionId },
      {
        onSuccess: () => toast.success("Purchase order approved"),
        onError: (e) => toast.error(poErrorToastMessage(e)),
      }
    );
  };

  const handleConfirmReject = () => {
    if (actionsDisabled) return;
    const result = validateRejectReason(rejectReason);
    if (!result.ok) {
      setRejectReasonError(result.message);
      return;
    }
    setRejectReasonError(null);
    reject.mutate(
      { id: purchaseOrder.id, requisitionId, reason: result.reason },
      {
        onSuccess: () => {
          toast.success("Purchase order rejected");
          closeRejectDialog();
        },
        onError: (e) => {
          if (e instanceof ApiError && (e.isConflict || e.isNotFound)) {
            toast.error(poErrorToastMessage(e));
            closeRejectDialog();
            return;
          }
          // Validation errors stay inline in the dialog (InlineError below) —
          // no toast, to avoid double-reporting the same message.
          if (!(e instanceof ApiError && e.isValidation)) {
            toast.error(poErrorToastMessage(e));
          }
        },
      }
    );
  };

  return {
    approve,
    reject,
    actionsDisabled,
    rejectDialogOpen,
    openRejectDialog,
    onRejectDialogChange,
    rejectReason,
    setRejectReason,
    rejectReasonError,
    handleApprove,
    handleConfirmReject,
  };
}
