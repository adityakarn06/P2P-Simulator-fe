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
import { requisitionKeys } from "@/hooks/use-requisitions";

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
 * Invalidates the PO detail + list, and — when called with a
 * `requisitionId` (e.g. from /requisitions/[id]) — the owning requisition's
 * detail query too, since `requisitionKeys.detail(id)` lives outside the
 * `requisitionKeys.all` namespace and is never reached by a broader
 * invalidation.
 */
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseOrderWithShipment,
    Error,
    { id: string; requisitionId?: string }
  >({
    mutationFn: ({ id }) => approvePurchaseOrder(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      if (variables.requisitionId) {
        queryClient.invalidateQueries({
          queryKey: requisitionKeys.detail(variables.requisitionId),
        });
        queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
      }
    },
  });
}

/**
 * Rejects a purchase order with a required reason. Idempotent.
 * Same invalidation shape as useApprovePurchaseOrder — see its comment.
 */
export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation<
    PurchaseOrderWithShipment,
    Error,
    { id: string; requisitionId?: string } & RejectPurchaseOrderBody
  >({
    mutationFn: ({ id, reason }) => rejectPurchaseOrder(id, { reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
      if (variables.requisitionId) {
        queryClient.invalidateQueries({
          queryKey: requisitionKeys.detail(variables.requisitionId),
        });
        queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
      }
    },
  });
}
