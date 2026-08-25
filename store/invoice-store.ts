import { create } from "zustand";

export type InvoiceListTab = "all" | "processing" | "extracted" | "exception" | "paid" | "failed";

interface InvoiceState {
  /** Active tab filter on /invoices. */
  activeTab: InvoiceListTab;
  setActiveTab: (tab: InvoiceListTab) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  activeTab: "all",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
