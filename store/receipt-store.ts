import { create } from "zustand";

export type ReceiptListTab = "all" | "pending" | "partial" | "completed";

interface ReceiptState {
  /** Active tab filter on /receipts. */
  activeTab: ReceiptListTab;
  setActiveTab: (tab: ReceiptListTab) => void;
}

export const useReceiptStore = create<ReceiptState>((set) => ({
  activeTab: "all",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
