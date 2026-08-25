"use client";

import { useInvoice } from "@/hooks/use-invoices";
import { getInvoicePollInterval, getInvoiceStatusMessage } from "@/lib/state/invoice-state";
import { Spinner } from "@/components/common/loading-state";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface ExceptionPaymentStatusProps {
  invoiceId: string;
}

/**
 * Shown only when a resolution just returned `releasedForPayment: true` —
 * the invoice has moved EXCEPTION → APPROVED and payment is queued. Polls
 * GET /invoices/:id (reusing the same interval/staleTime pattern as
 * components/invoices/invoice-detail.tsx) until it reaches PAID.
 */
export function ExceptionPaymentStatus({ invoiceId }: ExceptionPaymentStatusProps) {
  const { data: invoice } = useInvoice(invoiceId, {
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status ? getInvoicePollInterval(status) : false;
    },
    staleTime: 0,
  });

  const paid = invoice?.status === "PAID";
  const message = paid
    ? getInvoiceStatusMessage("PAID")
    : { title: "Approved. Payment processing.", tone: "success" as const };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-4 text-sm",
        "border-emerald-500/40 bg-emerald-500/5"
      )}
    >
      {paid ? (
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
      ) : (
        <Spinner size="sm" className="shrink-0" />
      )}
      <p>{message.title}</p>
    </div>
  );
}
