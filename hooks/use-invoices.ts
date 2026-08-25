"use client";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  getInvoice,
  listInvoices,
  uploadInvoice,
  type ListInvoicesParams,
} from "@/lib/api/invoices";
import type { Invoice } from "@/types/models";
import { ApiError, type CursorPaginatedData } from "@/types/api";
import { purchaseOrderKeys } from "@/hooks/use-purchase-orders";
import { requisitionKeys } from "@/hooks/use-requisitions";

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters: ListInvoicesParams) =>
    [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => ["invoice", id] as const,
} as const;

/**
 * Fetches a single invoice by id.
 * Query key: ["invoice", id]
 *
 * Poll this while status is UPLOADED or PROCESSING (~1s interval).
 * Stop polling and show failureReason when status = FAILED.
 */
export function useInvoice(
  id: string,
  options?: Omit<UseQueryOptions<Invoice>, "queryKey" | "queryFn">
) {
  return useQuery<Invoice>({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => getInvoice(id),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Lists invoices, newest first.
 * Query key: ["invoices", "list", filters]
 *
 * Filter by `status` or `purchaseOrderId`.
 */
export function useInvoices(
  filters: ListInvoicesParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<Invoice>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<Invoice>>({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => listInvoices(filters),
    ...options,
  });
}

export interface UploadInvoiceVariables {
  file: File;
  purchaseOrderId: string;
  /**
   * The owning requisition, when the upload happens from
   * /requisitions/[id]. Invoice has no requisitionId of its own — this is
   * threaded through purely for cache invalidation, mirroring
   * SimulateReceiptVariables in hooks/use-shipments.ts.
   */
  requisitionId?: string;
}

/**
 * Invalidates the invoices list plus — when the purchase order or
 * requisition are known — their detail/list queries, since a new invoice
 * changes what those screens should show next (e.g. the workflow timeline's
 * Invoice stage). Both purchaseOrderKeys.detail() and requisitionKeys.detail()
 * are flat keys, not reached by invalidating their `.all`/`.lists()`
 * namespace, so each is invalidated explicitly.
 */
function invalidateAfterUpload(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: UploadInvoiceVariables
) {
  queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
  queryClient.invalidateQueries({
    queryKey: purchaseOrderKeys.detail(variables.purchaseOrderId),
  });
  queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lists() });
  if (variables.requisitionId) {
    queryClient.invalidateQueries({
      queryKey: requisitionKeys.detail(variables.requisitionId),
    });
    queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
  }
}

/**
 * Uploads an invoice (multipart, PDF/PNG/JPEG, max 10 MB).
 * Returns 202 — extraction is async. Immediately start polling useInvoice(id).
 *
 * On a 409 (the PO moved out of an invoiceable state — e.g. another tab
 * already advanced it) or 404 (the PO no longer exists), the same
 * invalidation runs so the UI reflects the real, current state instead of
 * showing a stale invoiceable PO next to an error toast — same rationale as
 * useApprovePurchaseOrder/useRejectPurchaseOrder in use-purchase-orders.ts.
 */
export function useUploadInvoice() {
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, UploadInvoiceVariables>({
    mutationFn: ({ file, purchaseOrderId }) =>
      uploadInvoice(file, purchaseOrderId),
    onSuccess: (_data, variables) => invalidateAfterUpload(queryClient, variables),
    onError: (error, variables) => {
      if (error instanceof ApiError && (error.isConflict || error.isNotFound)) {
        invalidateAfterUpload(queryClient, variables);
      }
    },
  });
}
