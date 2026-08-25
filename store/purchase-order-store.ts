import { create } from "zustand";

/**
 * Client/UI state for the purchase-order reject dialog. Approve/reject
 * mutations themselves stay in hooks/use-purchase-orders.ts.
 */

interface PurchaseOrderState {
  /** id of the PO whose reject dialog is open, or null if none. */
  rejectDialogOpenFor: string | null;
  openRejectDialog: (purchaseOrderId: string) => void;
  closeRejectDialog: () => void;

  rejectReason: string;
  /** Setting the reason clears any stale validation error. */
  setRejectReason: (reason: string) => void;

  rejectReasonError: string | null;
  setRejectReasonError: (error: string | null) => void;
}

export const usePurchaseOrderStore = create<PurchaseOrderState>((set) => ({
  rejectDialogOpenFor: null,
  openRejectDialog: (purchaseOrderId) => set({ rejectDialogOpenFor: purchaseOrderId }),
  closeRejectDialog: () =>
    set({ rejectDialogOpenFor: null, rejectReason: "", rejectReasonError: null }),

  rejectReason: "",
  setRejectReason: (rejectReason) => set({ rejectReason, rejectReasonError: null }),

  rejectReasonError: null,
  setRejectReasonError: (rejectReasonError) => set({ rejectReasonError }),
}));
