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
import type { CursorPaginatedData } from "@/types/api";

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

/**
 * Uploads an invoice (multipart, PDF/PNG/JPEG, max 10 MB).
 * Returns 202 — extraction is async. Immediately start polling useInvoice(id).
 * On success, invalidates the invoices list.
 */
export function useUploadInvoice() {
  const queryClient = useQueryClient();

  return useMutation<Invoice, Error, { file: File; purchaseOrderId: string }>({
    mutationFn: ({ file, purchaseOrderId }) =>
      uploadInvoice(file, purchaseOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
  });
}
