import { apiClient } from "./client";
import type { Shipment, GoodsReceipt } from "@/types/models";

/**
 * GET /shipments/:id response envelope.
 * `goodsReceipt` is null until delivery is recorded via POST /receipts/simulate.
 */
export interface ShipmentWithReceipt {
  shipment: Shipment;
  goodsReceipt: GoodsReceipt | null;
}

/**
 * GET /api/v1/shipments/:id
 * Returns the shipment and its goods receipt (if delivery has been simulated).
 * The shipment id comes from the approve response or from GET /purchase-orders/:id.
 */
export async function getShipment(id: string): Promise<ShipmentWithReceipt> {
  return apiClient.get<ShipmentWithReceipt>(`/shipments/${id}`);
}
