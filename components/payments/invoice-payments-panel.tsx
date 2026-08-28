"use client";

import Link from "next/link";
import { useInvoicePayments } from "@/hooks/use-payments";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { InlineError } from "@/components/common/error-state";
import { SkeletonTable } from "@/components/common/loading-state";
import {
  getPaymentBlockReason,
  getPaymentKindLabel,
  hasShortfall,
} from "@/lib/state/payment-state";
import { formatDateTime } from "@/lib/formatters";
import type { Payment } from "@/types/payments";

interface InvoicePaymentsPanelProps {
  invoiceId: string;
}

/**
 * Every settlement tranche against one invoice, from GET /payments?invoiceId=.
 *
 * An invoice is not paid all-or-nothing — a clean match writes an `auto`
 * tranche, and each human-approved partial writes its own — so the single
 * invoice status cannot say how much has actually moved. Renders nothing at all
 * when there are no tranches: an invoice still in extraction has no payment
 * story to tell, and an empty card would only add noise.
 */
export function InvoicePaymentsPanel({ invoiceId }: InvoicePaymentsPanelProps) {
  const { data, isLoading, isError, error } = useInvoicePayments(invoiceId);
  const payments = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-3 text-sm font-medium">Payments</p>
        <SkeletonTable rows={2} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Payments</p>
        <InlineError error={error} />
      </div>
    );
  }

  if (payments.length === 0) return null;

  // A property of the invoice rather than of any one row, so it is read off the
  // first tranche instead of being summed — every tranche reports the same figure.
  const [first] = payments;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Payments</p>
        <p className="text-xs text-muted-foreground">
          <Money paise={first.invoiceSettledPaise} className="font-medium text-foreground" />{" "}
          settled
          {hasShortfall(first) && (
            <>
              {" · "}
              <Money paise={first.shortfallPaise} /> outstanding
            </>
          )}
        </p>
      </div>

      <ul className="divide-y">
        {payments.map((payment) => (
          <PaymentRow key={payment.id} payment={payment} />
        ))}
      </ul>
    </div>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const blockReason = getPaymentBlockReason(payment);

  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/payments/${payment.id}`}
            className="text-sm font-medium hover:underline"
          >
            <Money paise={payment.amountPaise} />
          </Link>
          <p className="text-xs text-muted-foreground">
            {getPaymentKindLabel(payment)}
            {payment.completedAt && ` · ${formatDateTime(payment.completedAt)}`}
          </p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      {payment.authorizationReason && (
        <p className="mt-1 text-xs text-muted-foreground">
          &ldquo;{payment.authorizationReason}&rdquo;
          {payment.authorizedBy && ` — ${payment.authorizedBy}`}
        </p>
      )}

      {blockReason && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{blockReason}</p>
      )}
    </li>
  );
}
