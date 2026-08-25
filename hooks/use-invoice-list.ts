"use client";

import { useInvoices } from "@/hooks/use-invoices";
import { useInvoiceStore } from "@/store/invoice-store";
import type { InvoiceListTab } from "@/store/invoice-store";
import type { InvoiceStatus } from "@/types/models";

const TAB_STATUS_MAP: Record<InvoiceListTab, InvoiceStatus | undefined> = {
  all: undefined,
  processing: "PROCESSING",
  extracted: "EXTRACTED",
  exception: "EXCEPTION",
  paid: "PAID",
  failed: "FAILED",
};

export function useInvoiceList() {
  const activeTab = useInvoiceStore((s) => s.activeTab);
  const setActiveTab = useInvoiceStore((s) => s.setActiveTab);
  const status = TAB_STATUS_MAP[activeTab];

  const query = useInvoices(status ? { status, limit: 50 } : { limit: 50 });

  return { activeTab, setActiveTab, ...query };
}
