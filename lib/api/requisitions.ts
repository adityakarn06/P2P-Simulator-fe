import { apiClient } from "./client";
import type {
  RequisitionChatResult,
  Requisition,
  RequisitionListItem,
  RequisitionStatus,
} from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export interface CreateRequisitionBody {
  /** 1–2000 chars after trim */
  input: string;
}

export interface SendRequisitionMessageBody {
  /** 1–2000 chars after trim */
  input: string;
}

export interface ListRequisitionsParams {
  status?: RequisitionStatus;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}


/**
 * POST /api/v1/requisitions
 * Starts a new requisition from a free-form message.
 * Waits up to ~20s for the worker reply (200) — 202 means still processing, poll GET /:id.
 */
export async function createRequisition(
  body: CreateRequisitionBody
): Promise<RequisitionChatResult> {
  return apiClient.post<RequisitionChatResult>("/requisitions", body);
}

/**
 * POST /api/v1/requisitions/:id/messages
 * Appends a follow-up user message. Same response shape as createRequisition.
 */
export async function sendRequisitionMessage(
  id: string,
  body: SendRequisitionMessageBody
): Promise<RequisitionChatResult> {
  return apiClient.post<RequisitionChatResult>(
    `/requisitions/${id}/messages`,
    body
  );
}

/**
 * GET /api/v1/requisitions/:id
 * Full requisition detail including messages, sourcing, and purchaseOrder.
 * Poll this while status is REQUIREMENTS_EXTRACTED (sourcing running) or
 * SUPPLIER_SELECTED (PO generation running).
 */
export async function getRequisition(id: string): Promise<Requisition> {
  return apiClient.get<Requisition>(`/requisitions/${id}`);
}

/**
 * GET /api/v1/requisitions
 * Cursor-paginated list, most recent first.
 */
export async function listRequisitions(
  params: ListRequisitionsParams = {}
): Promise<CursorPaginatedData<RequisitionListItem>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiClient.get<CursorPaginatedData<RequisitionListItem>>(
    `/requisitions${qs ? `?${qs}` : ""}`
  );
}
