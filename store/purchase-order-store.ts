import { create } from "zustand";

export type PurchaseOrderListTab =
  | "all"
  | "pending"
  | "approved"
  | "shipped"
  | "received"
  | "rejected";

interface PurchaseOrderState {
  /** Active tab filter on /purchase-orders. */
  activeTab: PurchaseOrderListTab;
  setActiveTab: (tab: PurchaseOrderListTab) => void;
}

export const usePurchaseOrderStore = create<PurchaseOrderState>((set) => ({
  activeTab: "all",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
