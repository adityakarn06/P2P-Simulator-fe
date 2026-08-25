"use client";

import { useShipmentList as useShipmentListQuery } from "@/hooks/use-shipments";
import { useShipmentStore } from "@/store/shipment-store";
import type { ShipmentListTab } from "@/store/shipment-store";
import type { ShipmentStatus } from "@/types/models";

const TAB_STATUS_MAP: Record<ShipmentListTab, ShipmentStatus | undefined> = {
  all: undefined,
  created: "CREATED",
  in_transit: "IN_TRANSIT",
  delivered: "DELIVERED",
};

export function useShipmentList() {
  const activeTab = useShipmentStore((s) => s.activeTab);
  const setActiveTab = useShipmentStore((s) => s.setActiveTab);
  const selectedShipmentId = useShipmentStore((s) => s.selectedShipmentId);
  const setSelectedShipmentId = useShipmentStore((s) => s.setSelectedShipmentId);
  const status = TAB_STATUS_MAP[activeTab];

  const query = useShipmentListQuery(status ? { status, limit: 50 } : { limit: 50 });

  return {
    activeTab,
    setActiveTab,
    selectedShipmentId,
    setSelectedShipmentId,
    ...query,
  };
}
