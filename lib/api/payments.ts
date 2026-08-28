import { apiClient } from "./client";
import type { CursorPaginatedData } from "@/types/api";
import type {
  Payment,
  PaymentDetail,
  PaymentKind,
  PaymentStatus,
} from "@/types/payments";

/**
 * Read-only settlement ledger. Source of truth: backend-docs/payments-api.md.
 *
 * There is deliberately no create/update/delete here — a payment is written by
 * the payment worker after a clean three-way match, or authorized by resolving
 * an exception with `PARTIAL_APPROVE`. Do not add a mutation to this module.
 */

export interface ListPaymentsParams {
  status?: PaymentStatus;
  /** `kind=PARTIAL` is the settlement-review view. */
  kind?: PaymentKind;
  /** Every tranche of one invoice. */
  invoiceId?: string;
  /** Every tranche against one purchase order. */
  purchaseOrderId?: string;
  /** Matched through the invoice. */
  supplierId?: string;
  /** ISO date — filters on `createdAt`. */
  from?: string;
  /** ISO date — filters on `createdAt`. */
  to?: string;
  /** 1–100, default 20 */
  limit?: number;
  cursor?: string;
}

/** GET /payments — list response uses a `payments` key (not `items`). */
interface PaymentListEnvelope {
  payments: Payment[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/payments
 * Cursor-paginated, newest first.
 *
 * `?kind=PARTIAL&status=COMPLETED` returns exactly the rows a settlement
 * review needs: each already carries the supplier, the PO number, the
 * shortfall, the written reason and the approver.
 */
export async function listPayments(
  params: ListPaymentsParams = {}
): Promise<CursorPaginatedData<Payment>> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.kind) search.set("kind", params.kind);
  if (params.invoiceId) search.set("invoiceId", params.invoiceId);
  if (params.purchaseOrderId) search.set("purchaseOrderId", params.purchaseOrderId);
  if (params.supplierId) search.set("supplierId", params.supplierId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const qs = search.toString();
  const envelope = await apiClient.get<PaymentListEnvelope>(
    `/payments${qs ? `?${qs}` : ""}`
  );

  // Normalise to the standard cursor shape used across the API layer.
  return { items: envelope.payments, nextCursor: envelope.nextCursor };
}

/**
 * GET /api/v1/payments/:id
 * The tranche plus the order-level ledger and the other tranches settling the
 * same purchase order. Returned whole — the caller needs all three together.
 */
export async function getPayment(id: string): Promise<PaymentDetail> {
  return apiClient.get<PaymentDetail>(`/payments/${id}`);
}
