"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getPayment,
  listPayments,
  type ListPaymentsParams,
} from "@/lib/api/payments";
import { getPaymentPollInterval } from "@/lib/state/payment-state";
import type { Payment, PaymentDetail } from "@/types/payments";
import type { CursorPaginatedData } from "@/types/api";

export const paymentKeys = {
  all: ["payments"] as const,
  lists: () => [...paymentKeys.all, "list"] as const,
  list: (filters: ListPaymentsParams) => [...paymentKeys.lists(), filters] as const,
  detail: (id: string) => ["payment", id] as const,
} as const;

/**
 * GET /payments — the settlement ledger, newest first.
 * Query key: ["payments", "list", filters]
 */
export function usePayments(
  filters: ListPaymentsParams = {},
  options?: Omit<UseQueryOptions<CursorPaginatedData<Payment>>, "queryKey" | "queryFn">
) {
  return useQuery<CursorPaginatedData<Payment>>({
    queryKey: paymentKeys.list(filters),
    queryFn: () => listPayments(filters),
    ...options,
  });
}

/**
 * Every tranche of one invoice. Enabled only with an id, so an invoice screen
 * can call it before the invoice has loaded.
 */
export function useInvoicePayments(
  invoiceId: string | undefined,
  options?: Omit<UseQueryOptions<CursorPaginatedData<Payment>>, "queryKey" | "queryFn">
) {
  const filters: ListPaymentsParams = { invoiceId: invoiceId ?? "", limit: 50 };
  return useQuery<CursorPaginatedData<Payment>>({
    queryKey: paymentKeys.list(filters),
    queryFn: () => listPayments(filters),
    enabled: Boolean(invoiceId),
    ...options,
  });
}

/**
 * GET /payments/:id — the tranche, the order-level ledger and the sibling
 * tranches against the same purchase order.
 * Query key: ["payment", id]
 *
 * Polls only while the payment is PENDING or PROCESSING; COMPLETED, FAILED and
 * BLOCKED are all resting states (see getPaymentPollInterval).
 */
export function usePayment(
  id: string,
  options?: Omit<UseQueryOptions<PaymentDetail>, "queryKey" | "queryFn">
) {
  return useQuery<PaymentDetail>({
    queryKey: paymentKeys.detail(id),
    queryFn: () => getPayment(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      return status ? getPaymentPollInterval(status) : false;
    },
    ...options,
  });
}
