"use client";

import Link from "next/link";
import { useInvoice } from "@/hooks/use-invoices";
import { StatusBadge } from "@/components/common/status-badge";
import { Spinner } from "@/components/common/loading-state";
import { Money } from "@/components/common/money";
import { DocumentActions } from "@/components/documents/document-actions";
import { getInvoicePdf } from "@/lib/api/documents";
import { fallbackDocumentFilename } from "@/lib/documents";
import {
  getInvoicePollInterval,
  getInvoiceStatusMessage,
  isInvoiceExtracting,
  isInvoiceWorking,
} from "@/lib/state/invoice-state";
import { formatFileSize, formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon } from "@/lib/icons";
import type { Invoice } from "@/types/models";

interface InvoiceRowProps {
  invoice: Invoice;
}

/**
 * Owns its own polling subscription so each invoice stops polling on its own
 * once it reaches a terminal status, independent of its siblings.
 * `initialData` avoids a loading flash for data the list query already
 * fetched.
 */
export function InvoiceRow({ invoice: initial }: InvoiceRowProps) {
  const { data: invoice } = useInvoice(initial.id, {
    initialData: initial,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data ? getInvoicePollInterval(data.status, data.source) : false;
    },
    staleTime: 0,
  });

  const i = invoice ?? initial;
  const extracting = isInvoiceExtracting(i.status);
  const working = isInvoiceWorking(i.status);
  const message = getInvoiceStatusMessage(i.status, i.failureReason);
  const extracted = i.extractedAt != null;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <Link href={`/invoices/${i.id}`} className="text-sm font-medium hover:underline">
            {i.invoiceNumber ?? `Invoice ${i.id.slice(0, 8)}…`}
          </Link>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(i.fileSizeBytes)} · Uploaded {formatDateTime(i.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={i.status} />
          <DocumentActions
            fetcher={() => getInvoicePdf(i.id)}
            fallbackFilename={fallbackDocumentFilename("invoice", i.invoiceNumber ?? i.id, i.fileMimeType)}
            title={i.invoiceNumber ?? `Invoice ${i.id.slice(0, 8)}…`}
            size="xs"
          />
        </div>
      </div>

      {extracted && i.totalPaise != null && (
        <p className="text-xs text-muted-foreground">
          Total <span className="font-medium text-foreground"><Money paise={i.totalPaise} /></span>
        </p>
      )}

      {i.status !== "FAILED" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {working && <Spinner size="sm" />}
          <span>
            {message.title}
            {extracting && ` (attempt ${i.extractionAttempts || 1} of 3)`}
          </span>
        </div>
      )}

      {i.status === "FAILED" && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
          <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-3.5 shrink-0" />
          <div className="space-y-1">
            <p>{message.title}</p>
            <p className="text-muted-foreground">
              There&apos;s no re-upload for this invoice — upload the document again as a new one to retry.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
