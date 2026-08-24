"use client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getPurchaseOrder,
  listPurchaseOrders,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  type PurchaseOrderWithShipment,
  type ListPurchaseOrdersParams,
  type RejectPurchaseOrderBody,
} from "@/lib/api/purchase-orders";
import type { PurchaseOrder } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export const purchaseOrderKeys = {
  all: ["purchase-orders"] as const,
  lists: () => [...purchaseOrderKeys.all, "list"] as const,
  list: (filters: ListPurchaseOrdersParams) =>
    [...purchaseOrderKeys.lists(), filters] as const,
  details: () => [...purchaseOrderKeys.all, "detail"] as const,
  detail: (id: string) => ["purchase-order", id] as const,
} as const;

/**
 * Fetches a purchase order with its associated shipment.
 * Query key: ["purchase-order", id]
 */
export function usePurchaseOrder(
  id: string,
  options?: Omit<
    UseQueryOptions<PurchaseOrderWithShipment>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<PurchaseOrderWithShipment>({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => getPurchaseOrder(id),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Lists purchase orders for the current organisation, newest first.
 * Query key: ["purchase-orders", "list", filters]
 */
export function usePurchaseOrders(
  filters: ListPurchaseOrdersParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<PurchaseOrder>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<PurchaseOrder>>({
    queryKey: purchaseOrderKeys.list(filters),
    queryFn: () => listPurchaseOrders(filters),
    ...options,
  });
}

/**
 * Approves a purchase order. Idempotent.
 * Invalidates both the specific PO detail and the full list.
 */
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<PurchaseOrderWithShipment, Error, string>({
    mutationFn: (id) => approvePurchaseOrder(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}

/**
 * Rejects a purchase order with a required reason. Idempotent.
 * Invalidates both the specific PO detail and the full list.
 */
export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseOrderWithShipment,
    Error,
    { id: string } & RejectPurchaseOrderBody
  >({
    mutationFn: ({ id, reason }) => rejectPurchaseOrder(id, { reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
    },
  });
}
