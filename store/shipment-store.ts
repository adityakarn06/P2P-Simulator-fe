import { create } from "zustand";

export type ShipmentListTab = "all" | "created" | "in_transit" | "delivered";

interface ShipmentState {
  /** Active tab filter on /shipments. */
  activeTab: ShipmentListTab;
  setActiveTab: (tab: ShipmentListTab) => void;
  /** The shipment shown in the detail pane; null = nothing selected. */
  selectedShipmentId: string | null;
  setSelectedShipmentId: (id: string | null) => void;
}

export const useShipmentStore = create<ShipmentState>((set) => ({
  activeTab: "all",
  // Switching tabs changes which rows are visible, so drop a selection that
  // may no longer be on screen rather than leave a stale detail pane up.
  setActiveTab: (activeTab) => set({ activeTab, selectedShipmentId: null }),
  selectedShipmentId: null,
  setSelectedShipmentId: (selectedShipmentId) => set({ selectedShipmentId }),
}));
