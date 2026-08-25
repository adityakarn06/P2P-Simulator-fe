"use client";

import { useRequisitions } from "@/hooks/use-requisitions";
import { useRequisitionStore } from "@/store/requisition-store";
import type { RequisitionListTab } from "@/store/requisition-store";
import type { RequisitionStatus } from "@/types/models";

const TAB_STATUS_MAP: Record<RequisitionListTab, RequisitionStatus | undefined> = {
  all: undefined,
  processing: "PROCESSING",
  needs_clarification: "NEEDS_CLARIFICATION",
  completed: "PO_CREATED",
  failed: "FAILED",
};

export function useRequisitionList() {
  const activeTab = useRequisitionStore((s) => s.listTab);
  const setActiveTab = useRequisitionStore((s) => s.setListTab);
  const status = TAB_STATUS_MAP[activeTab];

  const query = useRequisitions(status ? { status, limit: 50 } : { limit: 50 });

  return { activeTab, setActiveTab, ...query };
}
