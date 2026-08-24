import { apiClient } from "./client";
import type { PurchaseOrder, PurchaseOrderStatus, Shipment } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

/**
 * Both GET /purchase-orders/:id and the approve/reject mutations return this.
 * `shipment` is null after a rejection, or before approval.
 */
export interface PurchaseOrderWithShipment {
  purchaseOrder: PurchaseOrder;
  shipment: Shipment | null;
}

export interface RejectPurchaseOrderBody {
  /** Required, 1–500 characters. Stored verbatim as rejectionReason. */
  reason: string;
}

export interface ListPurchaseOrdersParams {
  status?: PurchaseOrderStatus;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/**
 * GET /api/v1/purchase-orders/:id
 * Returns the purchase order and its associated shipment (if approved).
 */
export async function getPurchaseOrder(
  id: string
): Promise<PurchaseOrderWithShipment> {
  return apiClient.get<PurchaseOrderWithShipment>(`/purchase-orders/${id}`);
}

/**
 * GET /api/v1/purchase-orders
 * Cursor-paginated list, newest first.
 */
export async function listPurchaseOrders(
  params: ListPurchaseOrdersParams = {}
): Promise<CursorPaginatedData<PurchaseOrder>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiClient.get<CursorPaginatedData<PurchaseOrder>>(
    `/purchase-orders${qs ? `?${qs}` : ""}`
  );
}

/**
 * POST /api/v1/purchase-orders/:id/approve
 * No request body. Idempotent — calling twice returns the same result.
 * Returns the updated purchase order and the newly created shipment (IN_TRANSIT).
 */
export async function approvePurchaseOrder(
  id: string
): Promise<PurchaseOrderWithShipment> {
  return apiClient.post<PurchaseOrderWithShipment>(
    `/purchase-orders/${id}/approve`
  );
}

/**
 * POST /api/v1/purchase-orders/:id/reject
 * `reason` is required (1–500 chars). Idempotent.
 * Returns the updated purchase order with `shipment: null`.
 */
export async function rejectPurchaseOrder(
  id: string,
  body: RejectPurchaseOrderBody
): Promise<PurchaseOrderWithShipment> {
  return apiClient.post<PurchaseOrderWithShipment>(
    `/purchase-orders/${id}/reject`,
    body
  );
}
