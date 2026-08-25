"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LoadingState, Spinner } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { buttonVariants } from "@/components/ui/button";
import { useInvoice } from "@/hooks/use-invoices";
import {
  getInvoicePollInterval,
  getInvoiceStatusMessage,
  isInvoiceExtracting,
  isInvoiceWorking,
} from "@/lib/state/invoice-state";
import { InvoiceExtractedFields } from "@/components/invoices/invoice-extracted-fields";
import { formatFileSize, formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, CheckmarkCircle02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { InvoiceStatusTone } from "@/lib/state/invoice-state";

interface InvoiceDetailProps {
  id: string;
}

/** Maps a status message's tone to the banner's border/background classes. */
const TONE_CLASSNAMES: Record<InvoiceStatusTone, string> = {
  info: "border-border bg-muted/40",
  progress: "border-primary/40 bg-primary/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
};

export function InvoiceDetail({ id }: InvoiceDetailProps) {
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id, {
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status ? getInvoicePollInterval(status) : false;
    },
    staleTime: 0,
  });

  if (isLoading) {
    return <LoadingState message="Loading invoice…" className="flex-1" />;
  }

  if (isError || !invoice) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const extracting = isInvoiceExtracting(invoice.status);
  const working = isInvoiceWorking(invoice.status);
  const message = getInvoiceStatusMessage(invoice.status, invoice.failureReason);
  const extracted = invoice.extractedAt != null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Invoice Detail"
        description={invoice.invoiceNumber ?? `Invoice ${invoice.id.slice(0, 8)}…`}
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Purchase order</p>
          <Link
            href={`/purchase-orders/${invoice.purchaseOrderId}`}
            className="text-sm font-mono hover:underline"
          >
            {invoice.purchaseOrderId.slice(0, 8)}…
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">File size</p>
          <p className="text-sm">{formatFileSize(invoice.fileSizeBytes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Uploaded</p>
          <p className="text-sm">{formatDateTime(invoice.createdAt)}</p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border p-4 text-sm",
          TONE_CLASSNAMES[message.tone]
        )}
      >
        {working && <Spinner size="sm" className="mt-0.5 shrink-0" />}
        {message.tone === "error" && (
          <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0" />
        )}
        {message.tone === "success" && invoice.status === "PAID" && (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="mt-0.5 size-4 shrink-0" />
        )}
        <div className="space-y-1">
          <p>{message.title}</p>
          {extracting && (
            <p className={message.tone === "error" ? undefined : "text-muted-foreground"}>
              Attempt {invoice.extractionAttempts || 1} of 3
            </p>
          )}
          {invoice.status === "FAILED" && (
            <p className="text-muted-foreground">
              There&apos;s no re-upload for this invoice — upload the document again as a new
              one to retry.
            </p>
          )}
          {invoice.status === "EXCEPTION" && (
            <Link
              href="/exceptions"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1")}
            >
              Review exception
            </Link>
          )}
          {invoice.status === "FAILED" && (
            <Link
              href="/requisitions"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1")}
            >
              Find the requisition to upload again
            </Link>
          )}
        </div>
      </div>

      {extracted && <InvoiceExtractedFields invoice={invoice} />}
    </div>
  );
}
