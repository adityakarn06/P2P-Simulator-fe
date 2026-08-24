"use client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { getShipment, type ShipmentWithReceipt } from "@/lib/api/shipments";
import {
  simulateReceipt,
  type SimulateReceiptBody,
  type SimulateReceiptResponse,
} from "@/lib/api/receipts";

export const shipmentKeys = {
  all: ["shipments"] as const,
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
 * Simulates a delivery event (IoT stand-in).
 * Accepts either the flat form (single-line POs) or explicit form (multi-line).
 * On success, invalidates the shipment detail so goodsReceipt is refreshed.
 */
export function useSimulateReceipt() {
  const queryClient = useQueryClient();

  return useMutation<SimulateReceiptResponse, Error, SimulateReceiptBody>({
    mutationFn: simulateReceipt,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: shipmentKeys.detail(variables.shipmentId),
      });
    },
  });
}
