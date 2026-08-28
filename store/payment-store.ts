import { create } from "zustand";

/**
 * Client/UI state for the settlement screens. Server data (the payments list
 * and detail) stays in hooks/use-payments.ts.
 */

/**
 * `partial` is the settlement-review view backend-docs/payments-api.md calls
 * out by name: `?kind=PARTIAL&status=COMPLETED` returns exactly the rows an SCM
 * manager needs to review — supplier, PO number, shortfall, written reason and
 * approver, all already on the row.
 */
export type PaymentListTab = "all" | "partial" | "pending" | "blocked" | "failed";

interface PaymentState {
  /** Active tab filter on /payments. */
  activeTab: PaymentListTab;
  setActiveTab: (tab: PaymentListTab) => void;
}

export const usePaymentStore = create<PaymentState>((set) => ({
  activeTab: "all",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
