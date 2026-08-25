import { apiClient } from "./client";
import type {
  Shipment,
  GoodsReceipt,
  GoodsReceiptStatus,
  GoodsReceiptListItem,
  PurchaseOrder,
} from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

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

export interface ListReceiptsParams {
  status?: GoodsReceiptStatus;
  purchaseOrderId?: string;
  shipmentId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/**
 * GET /api/v1/receipts
 * Cursor-paginated list, newest first. Summary rows only — no items[]; use
 * GET /shipments/:id (goodsReceipt.items) for the per-line breakdown.
 */
export async function listReceipts(
  params: ListReceiptsParams = {}
): Promise<CursorPaginatedData<GoodsReceiptListItem>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.purchaseOrderId) search.set("purchaseOrderId", params.purchaseOrderId);
  if (params.shipmentId) search.set("shipmentId", params.shipmentId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiClient.get<CursorPaginatedData<GoodsReceiptListItem>>(
    `/receipts${qs ? `?${qs}` : ""}`
  );
}
