"use client";

import { usePayments } from "@/hooks/use-payments";
import { usePaymentStore, type PaymentListTab } from "@/store/payment-store";
import { PAYMENT_POLL_MS } from "@/lib/state/payment-state";
import type { ListPaymentsParams } from "@/lib/api/payments";

/**
 * The /payments screen's filters and data.
 *
 * `partial` is the settlement-review view backend-docs/payments-api.md names
 * explicitly: `kind=PARTIAL&status=COMPLETED` — partial tranches that actually
 * settled, which is what a review is about. A PARTIAL row still PENDING is not
 * yet a short payment anyone can review.
 */
const TAB_FILTERS: Record<PaymentListTab, ListPaymentsParams> = {
  all: {},
  partial: { kind: "PARTIAL", status: "COMPLETED" },
  pending: { status: "PENDING" },
  blocked: { status: "BLOCKED" },
  failed: { status: "FAILED" },
};

export function usePaymentList() {
  const activeTab = usePaymentStore((s) => s.activeTab);
  const setActiveTab = usePaymentStore((s) => s.setActiveTab);

  const query = usePayments(
    { ...TAB_FILTERS[activeTab], limit: 50 },
    {
      // Only the pending view is watching work in flight; the settled and
      // refused views are looking at rows that will not change on their own.
      refetchInterval: activeTab === "pending" ? PAYMENT_POLL_MS : false,
    }
  );

  return { activeTab, setActiveTab, ...query };
}
