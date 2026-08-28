import { apiClient, type BinaryResponse } from "./client";
import type { Invoice } from "@/types/models";

/**
 * See backend-docs/documents-api.md. All three /pdf endpoints return a
 * binary body on 200 (no JSON envelope) and the normal
 * { success: false, error } envelope on a 404 before rendering starts —
 * apiClient.getBlob() handles both.
 */

/** GET /api/v1/purchase-orders/:id/pdf — re-rendered on every call, nothing stored. */
export function getPurchaseOrderPdf(id: string): Promise<BinaryResponse> {
  return apiClient.getBlob(`/purchase-orders/${id}/pdf`);
}

/** GET /api/v1/receipts/:id/pdf — re-rendered on every call, nothing stored. */
export function getReceiptPdf(id: string): Promise<BinaryResponse> {
  return apiClient.getBlob(`/receipts/${id}/pdf`);
}

/**
 * GET /api/v1/invoices/:id/pdf — streams the invoice's stored bytes.
 * Content-Type follows the file's own stored MIME type (PDF for a
 * GENERATED invoice; PDF, PNG or JPEG for an UPLOADED one), not a hardcoded
 * application/pdf.
 */
export function getInvoicePdf(id: string): Promise<BinaryResponse> {
  return apiClient.getBlob(`/invoices/${id}/pdf`);
}

export interface GenerateInvoiceItemOverride {
  purchaseOrderItemId: string;
  quantity: number;
}

interface GenerateInvoiceResponseEnvelope {
  invoice: Invoice;
}

/**
 * POST /api/v1/purchase-orders/:id/generate-invoice
 * Renders a demo supplier invoice from the PO's own data — source:
 * "GENERATED", created straight at EXTRACTED. Idempotent: a repeat call
 * returns the invoice already on file (200) rather than rendering a second
 * one (201 on the first call).
 *
 * Omit `items` entirely for the default "bill exactly what was ordered"
 * behavior — sending an empty array is a different, technically-valid body
 * but the docs describe omission as the no-override path, so callers with no
 * overrides should not pass `items` at all.
 */
export async function generateInvoice(
  purchaseOrderId: string,
  items?: GenerateInvoiceItemOverride[]
): Promise<Invoice> {
  const body = items && items.length > 0 ? { items } : undefined;
  const envelope = await apiClient.post<GenerateInvoiceResponseEnvelope>(
    `/purchase-orders/${purchaseOrderId}/generate-invoice`,
    body
  );
  return envelope.invoice;
}
