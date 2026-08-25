"use client";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  listReceipts,
  type ListReceiptsParams,
} from "@/lib/api/receipts";
import type { GoodsReceiptListItem } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export const receiptKeys = {
  all: ["receipts"] as const,
  lists: () => [...receiptKeys.all, "list"] as const,
  list: (filters: ListReceiptsParams) => [...receiptKeys.lists(), filters] as const,
} as const;

/**
 * Lists goods receipts for the current organisation, newest first.
 * Summary rows only — no line items; use useShipment(shipmentId) for the
 * per-line breakdown (goodsReceipt.items).
 * Query key: ["receipts", "list", filters]
 */
export function useReceiptList(
  filters: ListReceiptsParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<GoodsReceiptListItem>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<GoodsReceiptListItem>>({
    queryKey: receiptKeys.list(filters),
    queryFn: () => listReceipts(filters),
    ...options,
  });
}
