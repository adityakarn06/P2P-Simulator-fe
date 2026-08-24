import { apiClient } from "./client";
import type { Shipment, GoodsReceipt, PurchaseOrder } from "@/types/models";

/**
 * Flat form — use for single-line purchase orders (what the MVP generates). Do NOT mix with the explicit form.
 */
export interface SimulateReceiptFlatBody {
  shipmentId: string;
  receivedQuantity: number;
  /** Defaults to 0 on the server */
  damagedQuantity?: number;
  receivedBy?: string;
  notes?: string;
}

/** One item in the explicit form */
export interface SimulateReceiptItem {
  purchaseOrderItemId: string;
  receivedQuantity: number;
  /** Defaults to 0 on the server */
  damagedQuantity?: number;
}

/**
 * Explicit form — use for multi-line purchase orders.
 * A line omitted from `items[]` is recorded as nothing received.
 */
export interface SimulateReceiptExplicitBody {
  shipmentId: string;
  items: SimulateReceiptItem[];
  receivedBy?: string;
  notes?: string;
}

export type SimulateReceiptBody =
  | SimulateReceiptFlatBody
  | SimulateReceiptExplicitBody;


export interface SimulateReceiptResponse {
  shipment: Shipment;
  goodsReceipt: GoodsReceipt;
  purchaseOrder: PurchaseOrder;
}


/**
 * POST /api/v1/receipts/simulate
 * Simulates a delivery event. Returns 201 on first call, 200 on idempotent replay.
 * Re-posting the same shipmentId with *different* quantities is rejected with 409.
 */
export async function simulateReceipt(
  body: SimulateReceiptBody
): Promise<SimulateReceiptResponse> {
  return apiClient.post<SimulateReceiptResponse>("/receipts/simulate", body);
}
