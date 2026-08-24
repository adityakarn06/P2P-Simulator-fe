import { apiClient } from "./client";
import type { Invoice, InvoiceStatus } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

/**
 * POST /invoices response nests the invoice under data.invoice (not data directly).
 * GET /invoices/:id returns the invoice directly as data.
 * Both shapes are normalised here so callers always get an Invoice.
 */
interface UploadInvoiceResponseEnvelope {
  invoice: Invoice;
}

export interface ListInvoicesParams {
  status?: InvoiceStatus;
  purchaseOrderId?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/**
 * POST /api/v1/invoices
 * Multipart upload. Returns 202 — no extraction has happened yet.
 * Poll GET /invoices/:id until status leaves UPLOADED/PROCESSING.
 *
 * Do NOT set Content-Type manually; apiClient.upload() handles the boundary.
 *
 * @param file  PDF, PNG or JPEG, max 10 MB.
 * @param purchaseOrderId  Must be APPROVED, SHIPPED, RECEIVED or COMPLETED.
 */
export async function uploadInvoice(
  file: File,
  purchaseOrderId: string
): Promise<Invoice> {
  const form = new FormData();
  form.append("file", file);
  form.append("purchaseOrderId", purchaseOrderId);

  const envelope =
    await apiClient.upload<UploadInvoiceResponseEnvelope>("/invoices", form);
  return envelope.invoice;
}

/**
 * GET /api/v1/invoices/:id
 * Returns the invoice directly as `data` (no nesting — unlike the upload response).
 */
export async function getInvoice(id: string): Promise<Invoice> {
  return apiClient.get<Invoice>(`/invoices/${id}`);
}

/**
 * GET /api/v1/invoices
 * Cursor-paginated list, newest first.
 */
export async function listInvoices(
  params: ListInvoicesParams = {}
): Promise<CursorPaginatedData<Invoice>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.purchaseOrderId) search.set("purchaseOrderId", params.purchaseOrderId);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  return apiClient.get<CursorPaginatedData<Invoice>>(
    `/invoices${qs ? `?${qs}` : ""}`
  );
}
