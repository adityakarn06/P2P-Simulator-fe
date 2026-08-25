"use client";

import { useReceiptList as useReceiptListQuery } from "@/hooks/use-receipts";
import { useReceiptStore } from "@/store/receipt-store";
import type { ReceiptListTab } from "@/store/receipt-store";
import type { GoodsReceiptStatus } from "@/types/models";

const TAB_STATUS_MAP: Record<ReceiptListTab, GoodsReceiptStatus | undefined> = {
  all: undefined,
  pending: "PENDING",
  partial: "PARTIAL",
  completed: "COMPLETED",
};

export function useReceiptList() {
  const activeTab = useReceiptStore((s) => s.activeTab);
  const setActiveTab = useReceiptStore((s) => s.setActiveTab);
  const status = TAB_STATUS_MAP[activeTab];

  const query = useReceiptListQuery(status ? { status, limit: 50 } : { limit: 50 });

  return { activeTab, setActiveTab, ...query };
}
