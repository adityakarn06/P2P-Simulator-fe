"use client";

import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { usePurchaseOrderStore } from "@/store/purchase-order-store";
import { PO_LIST_TAB_STATUS, getPurchaseOrderListPollInterval } from "@/lib/state/purchase-order-state";

export function usePurchaseOrderList() {
  const activeTab = usePurchaseOrderStore((s) => s.activeTab);
  const setActiveTab = usePurchaseOrderStore((s) => s.setActiveTab);
  const status = PO_LIST_TAB_STATUS[activeTab];

  const query = usePurchaseOrders(
    status ? { status, limit: 50 } : { limit: 50 },
    {
      refetchInterval: (q) => getPurchaseOrderListPollInterval(q.state.data?.items ?? []),
    }
  );

  return { activeTab, setActiveTab, ...query };
}
