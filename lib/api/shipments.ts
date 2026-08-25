import { apiClient } from "./client";
import type { Shipment, ShipmentStatus, GoodsReceipt } from "@/types/models";
import type { ShipmentListItem } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

/**
 * GET /shipments/:id response envelope.
 * `goodsReceipt` is null until delivery is recorded via POST /receipts/simulate.
 */
export interface ShipmentWithReceipt {
  shipment: Shipment;
  goodsReceipt: GoodsReceipt | null;
}

export interface ListShipmentsParams {
  status?: ShipmentStatus;
  purchaseOrderId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/**
 * GET /api/v1/shipments/:id
 * Returns the shipment and its goods receipt (if delivery has been simulated).
 * The shipment id comes from the approve response or from GET /purchase-orders/:id.
 */
export async function getShipment(id: string): Promise<ShipmentWithReceipt> {
  return apiClient.get<ShipmentWithReceipt>(`/shipments/${id}`);
}

/**
 * GET /api/v1/shipments
 * Cursor-paginated list, newest first. Rows carry `poNumber` so the list page
 * can render a human-readable identifier without a round-trip per row. Does
 * not include `goodsReceipt` — use GET /shipments/:id or GET /receipts.
 */
export async function listShipments(
  params: ListShipmentsParams = {}
): Promise<CursorPaginatedData<ShipmentListItem>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.purchaseOrderId) search.set("purchaseOrderId", params.purchaseOrderId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiClient.get<CursorPaginatedData<ShipmentListItem>>(
    `/shipments${qs ? `?${qs}` : ""}`
  );
}
