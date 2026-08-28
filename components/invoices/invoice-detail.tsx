"use client";

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { LoadingState, Spinner } from "@/components/common/loading-state";
import { ErrorState, InlineError } from "@/components/common/error-state";
import { Callout } from "@/components/common/callout";
import { buttonVariants } from "@/components/ui/button";
import { useInvoice } from "@/hooks/use-invoices";
import { useExceptions } from "@/hooks/use-exceptions";
import { isResolvable } from "@/lib/state/exception-state";
import {
  getInvoicePollInterval,
  getInvoiceStatusMessage,
  isInvoiceExtracting,
  isInvoiceWorking,
} from "@/lib/state/invoice-state";
import { InvoiceExtractedFields } from "@/components/invoices/invoice-extracted-fields";
import { DocumentActions } from "@/components/documents/document-actions";
import { getInvoicePdf } from "@/lib/api/documents";
import { fallbackDocumentFilename } from "@/lib/documents";
import { formatFileSize, formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, CheckmarkCircle02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
interface InvoiceDetailProps {
  id: string;
}

export function InvoiceDetail({ id }: InvoiceDetailProps) {
  const { data: invoice, isLoading, isError, error, refetch } = useInvoice(id, {
    refetchInterval: (query) => {
      const data = query.state.data;
      return data ? getInvoicePollInterval(data.status, data.source) : false;
    },
    staleTime: 0,
  });

  // Only needed to link "Review exception" straight to the blocking
  // exception instead of the generic inbox.
  const exceptions = useExceptions(
    { entityId: id, limit: 100 },
    { enabled: invoice?.status === "EXCEPTION" }
  );
  const blockingException = exceptions.data?.items.find((e) => isResolvable(e.status));

  if (isLoading) {
    return <LoadingState message="Loading invoice…" className="flex-1" />;
  }

  if (isError || !invoice) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const isGenerated = invoice.source === "GENERATED";
  const extracting = !isGenerated && isInvoiceExtracting(invoice.status);
  const working = !isGenerated && isInvoiceWorking(invoice.status);
  // A GENERATED invoice (backend-docs/documents-api.md) is created straight
  // at EXTRACTED and never enters matching, so the scripted EXTRACTED copy
  // ("Checking invoice against the PO") would describe work that will never
  // happen and never resolve, since polling is off for this source.
  const message = isGenerated
    ? {
        title: "Demo document — not matched or paid. Download it, then upload as a new invoice to run three-way matching.",
        tone: "info" as const,
      }
    : getInvoiceStatusMessage(invoice.status, invoice.failureReason);
  const extracted = invoice.extractedAt != null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Invoice Detail"
        description={invoice.invoiceNumber ?? `Invoice ${invoice.id.slice(0, 8)}…`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={invoice.status} />
            <DocumentActions
              fetcher={() => getInvoicePdf(invoice.id)}
              fallbackFilename={fallbackDocumentFilename(
                "invoice",
                invoice.invoiceNumber ?? invoice.id,
                invoice.fileMimeType
              )}
              title={invoice.invoiceNumber ?? `Invoice ${invoice.id.slice(0, 8)}…`}
            />
          </div>
        }
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
          <p className="text-sm">
            {invoice.fileSizeBytes != null ? formatFileSize(invoice.fileSizeBytes) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Uploaded</p>
          <p className="text-sm">{formatDateTime(invoice.createdAt)}</p>
        </div>
      </div>

      <Callout
        tone={message.tone}
        icon={
          working ? (
            <Spinner size="sm" />
          ) : message.tone === "error" ? (
            <HugeiconsIcon icon={Alert01Icon} className="size-4" />
          ) : message.tone === "success" && invoice.status === "PAID" ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
          ) : undefined
        }
      >
        <p>{message.title}</p>
        {extracting && (
          <p className={message.tone === "error" ? undefined : "text-muted-foreground"}>
            Attempt {invoice.extractionAttempts || 1} of 3
          </p>
        )}
        {invoice.status === "FAILED" && (
          <p className="text-muted-foreground">
            There&apos;s no re-upload for this invoice — upload the document again as a new one
            to retry.
          </p>
        )}
        {invoice.status === "EXCEPTION" && (
          <>
            {exceptions.isError && <InlineError error={exceptions.error} />}
            <Link
              href={blockingException ? `/exceptions/${blockingException.id}` : "/exceptions"}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1")}
            >
              Review exception
            </Link>
          </>
        )}
        {invoice.status === "FAILED" && (
          <Link
            href="/requisitions"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-1")}
          >
            Find the requisition to upload again
          </Link>
        )}
      </Callout>

      {extracted && <InvoiceExtractedFields invoice={invoice} />}
    </div>
  );
}
