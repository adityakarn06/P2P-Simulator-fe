"use client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getShipment,
  listShipments,
  type ShipmentWithReceipt,
  type ListShipmentsParams,
} from "@/lib/api/shipments";
import {
  simulateReceipt,
  type SimulateReceiptBody,
  type SimulateReceiptResponse,
} from "@/lib/api/receipts";
import type { ShipmentListItem } from "@/types/models";
import { ApiError, type CursorPaginatedData } from "@/types/api";
import { purchaseOrderKeys } from "@/hooks/use-purchase-orders";
import { requisitionKeys } from "@/hooks/use-requisitions";
import { receiptKeys } from "@/hooks/use-receipts";

export const shipmentKeys = {
  all: ["shipments"] as const,
  lists: () => [...shipmentKeys.all, "list"] as const,
  list: (filters: ListShipmentsParams) => [...shipmentKeys.lists(), filters] as const,
  details: () => [...shipmentKeys.all, "detail"] as const,
  detail: (id: string) => ["shipment", id] as const,
} as const;

/**
 * Fetches a shipment and its goods receipt (null until delivery is simulated).
 * Query key: ["shipment", id]
 *
 * The shipment id comes from the approve response or GET /purchase-orders/:id.
 */
export function useShipment(
  id: string,
  options?: Omit<UseQueryOptions<ShipmentWithReceipt>, "queryKey" | "queryFn">
) {
  return useQuery<ShipmentWithReceipt>({
    queryKey: shipmentKeys.detail(id),
    queryFn: () => getShipment(id),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Lists shipments for the current organisation, newest first.
 * Query key: ["shipments", "list", filters]
 */
export function useShipmentList(
  filters: ListShipmentsParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<ShipmentListItem>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<ShipmentListItem>>({
    queryKey: shipmentKeys.list(filters),
    queryFn: () => listShipments(filters),
    ...options,
  });
}

export interface SimulateReceiptVariables {
  body: SimulateReceiptBody;
  /** For invalidating the owning requisition's detail + list queries. */
  requisitionId?: string;
  /** For invalidating the owning purchase order's detail + list queries. */
  purchaseOrderId?: string;
}

/**
 * Invalidates every query the receipt affects: the shipment (now DELIVERED
 * with a goodsReceipt), the purchase order (now RECEIVED — flat detail key,
 * not reached by invalidating shipmentKeys.all/purchaseOrderKeys.all), and
 * the owning requisition (its embedded purchaseOrder.status changed too).
 * Mirrors invalidatePurchaseOrder in hooks/use-purchase-orders.ts.
 */
function invalidateAfterReceipt(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: SimulateReceiptVariables
) {
  queryClient.invalidateQueries({
    queryKey: shipmentKeys.detail(variables.body.shipmentId),
  });
  queryClient.invalidateQueries({ queryKey: shipmentKeys.lists() });
  queryClient.invalidateQueries({ queryKey: receiptKeys.lists() });
  if (variables.purchaseOrderId) {
    queryClient.invalidateQueries({
      queryKey: purchaseOrderKeys.detail(variables.purchaseOrderId),
    });
    queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
  }
  if (variables.requisitionId) {
    queryClient.invalidateQueries({
      queryKey: requisitionKeys.detail(variables.requisitionId),
    });
    queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
  }
}

/**
 * Simulates a delivery event (IoT stand-in).
 * Accepts either the flat form (single-line POs) or explicit form (multi-line).
 *
 * On success, invalidates the shipment, purchase order, and requisition
 * queries — a receipt moves all three. On a 409 (conflict/invalid-state) or
 * 404, the same invalidation runs so the UI reflects the real, current state
 * instead of showing a stale IN_TRANSIT shipment next to an error.
 */
export function useSimulateReceipt() {
  const queryClient = useQueryClient();

  return useMutation<SimulateReceiptResponse, Error, SimulateReceiptVariables>({
    mutationFn: ({ body }) => simulateReceipt(body),
    onSuccess: (_data, variables) => invalidateAfterReceipt(queryClient, variables),
    onError: (error, variables) => {
      if (error instanceof ApiError && (error.isConflict || error.isNotFound)) {
        invalidateAfterReceipt(queryClient, variables);
      }
    },
  });
}
