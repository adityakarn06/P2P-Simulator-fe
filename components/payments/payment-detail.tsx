"use client";

import Link from "next/link";
import { usePayment } from "@/hooks/use-payments";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { Money } from "@/components/common/money";
import { SettlementLedger } from "@/components/payments/settlement-ledger";
import {
  getPaymentBlockReason,
  getPaymentKindLabel,
  hasShortfall,
  isHumanAuthorized,
} from "@/lib/state/payment-state";
import { formatCurrencyFromPaise, formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@/lib/icons";

interface PaymentDetailProps {
  id: string;
}

export function PaymentDetail({ id }: PaymentDetailProps) {
  const { data, isLoading, isError, error, refetch } = usePayment(id);

  if (isLoading) {
    return <LoadingState message="Loading payment…" className="flex-1" />;
  }

  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const { payment, ledger, siblings } = data;
  const blockReason = getPaymentBlockReason(payment);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Link
        href="/payments"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        Back to payments
      </Link>

      <PageHeader
        title={formatCurrencyFromPaise(payment.amountPaise)}
        description={getPaymentKindLabel(payment)}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={payment.kind} />
            <StatusBadge status={payment.status} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="text-sm font-medium">
            <Money paise={payment.amountPaise} />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Invoice</p>
          <Link
            href={`/invoices/${payment.invoiceId}`}
            className="text-sm font-mono hover:underline"
          >
            {payment.invoice?.invoiceNumber ?? `${payment.invoiceId.slice(0, 8)}…`}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Purchase order</p>
          <Link
            href={`/purchase-orders/${payment.purchaseOrderId}`}
            className="text-sm font-mono hover:underline"
          >
            {payment.purchaseOrder?.poNumber ?? `${payment.purchaseOrderId.slice(0, 8)}…`}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Supplier</p>
          {payment.invoice?.supplier ? (
            <Link
              href={`/suppliers/${payment.invoice.supplier.id}`}
              className="text-sm hover:underline"
            >
              {payment.invoice.supplier.name}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {blockReason && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">
            {payment.status === "BLOCKED" ? "Settlement blocked" : "Settlement failed"}
          </p>
          <p className="mt-1 text-muted-foreground">{blockReason}</p>
        </div>
      )}

      {isHumanAuthorized(payment) && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Authorized by a human</p>
          {payment.authorizationReason && (
            <p className="mt-1 text-muted-foreground">
              &ldquo;{payment.authorizationReason}&rdquo;
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {payment.authorizedBy && `${payment.authorizedBy} · `}
            {payment.createdAt && formatDateTime(payment.createdAt)}
          </p>
          {payment.authorizingExceptionId && (
            <Link
              href={`/exceptions/${payment.authorizingExceptionId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open the exception this settled
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Link>
          )}
        </div>
      )}

      <SettlementLedger ledger={ledger} />

      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Provider</p>
          <p className="text-sm">{payment.provider}</p>
          {payment.providerReference && (
            <p className="text-xs font-mono text-muted-foreground">
              {payment.providerReference}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Settlement key</p>
          <p className="text-sm font-mono">{payment.settlementKey}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-sm">
            {payment.completedAt ? formatDateTime(payment.completedAt) : "—"}
          </p>
        </div>
      </div>

      {/*
        Every tranche of one invoice reports the same invoice-level figures, so
        this describes the invoice, not this row's share of it.
      */}
      {hasShortfall(payment) && (
        <p className="text-xs text-muted-foreground">
          This invoice has been paid <Money paise={payment.invoiceSettledPaise} /> of{" "}
          <Money paise={payment.invoice?.totalPaise ?? 0} /> billed —{" "}
          <Money paise={payment.shortfallPaise} /> still outstanding.
        </p>
      )}

      {siblings.length > 0 && (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Other tranches against this purchase order</p>
          <ul className="divide-y">
            {siblings.map((sibling) => (
              <li
                key={sibling.id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/payments/${sibling.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    <Money paise={sibling.amountPaise} />
                  </Link>
                  <p className="text-xs font-mono text-muted-foreground">
                    {sibling.settlementKey}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={sibling.kind} />
                  <StatusBadge status={sibling.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
