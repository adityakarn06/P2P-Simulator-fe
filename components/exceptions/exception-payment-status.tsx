"use client";

import { useInvoice } from "@/hooks/use-invoices";
import {
  getInvoicePollInterval,
  getInvoiceStatusMessage,
  isInvoiceSettling,
} from "@/lib/state/invoice-state";
import { Spinner } from "@/components/common/loading-state";
import { InlineError } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, RefreshIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface ExceptionPaymentStatusProps {
  invoiceId: string;
}

/**
 * Shown only when a resolution just returned `releasedForPayment: true` —
 * the invoice has moved EXCEPTION → APPROVED and payment is queued. Polls
 * GET /invoices/:id (reusing the same interval/staleTime pattern as
 * components/invoices/invoice-detail.tsx) until settlement lands.
 *
 * PARTIALLY_PAID counts as landed: after a PARTIAL_APPROVE the terminal state
 * is PARTIALLY_PAID, not PAID, so waiting for PAID would spin forever on the
 * outcome the approver deliberately chose.
 */
export function ExceptionPaymentStatus({ invoiceId }: ExceptionPaymentStatusProps) {
  const { data: invoice, isError, error, refetch } = useInvoice(invoiceId, {
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status ? getInvoicePollInterval(status) : false;
    },
    staleTime: 0,
  });

  if (isError) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border p-4 text-sm",
          "border-destructive/40 bg-destructive/5"
        )}
      >
        <InlineError error={error} className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => refetch()}>
          <HugeiconsIcon icon={RefreshIcon} className="size-4" />
          Retry
        </Button>
      </div>
    );
  }

  const settled = invoice != null && isInvoiceSettling(invoice.status);
  const message = settled
    ? getInvoiceStatusMessage(invoice.status)
    : { title: "Approved. Payment processing.", tone: "success" as const };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border p-4 text-sm",
        "border-emerald-500/40 bg-emerald-500/5"
      )}
    >
      {settled ? (
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
      ) : (
        <Spinner size="sm" className="shrink-0" />
      )}
      <p>{message.title}</p>
    </div>
  );
}
