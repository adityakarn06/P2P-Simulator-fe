"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/money";
import { Spinner, SkeletonLines } from "@/components/common/loading-state";
import { DocumentActions } from "@/components/documents/document-actions";
import { GenerateInvoiceDialog } from "@/components/invoices/generate-invoice-dialog";
import { getInvoicePdf } from "@/lib/api/documents";
import { useGenerateInvoice, useDownloadDocument } from "@/hooks/use-documents";
import {
  validateGenerateInvoiceOverrides,
  type GenerateInvoiceRawLine,
} from "@/lib/state/invoice-state";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/types/api";
import type { Invoice, PurchaseOrder, PurchaseOrderItem } from "@/types/models";

interface GeneratedInvoicePanelProps {
  requisitionId: string;
  purchaseOrder: Pick<PurchaseOrder, "id"> & {
    items: Pick<PurchaseOrderItem, "id" | "description" | "quantity">[];
  };
  generatedInvoice: Invoice | undefined;
  isLoading: boolean;
  disabled?: boolean;
}

function generateErrorToastMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isConflict) return "This purchase order can no longer be invoiced — refreshed.";
    if (e.isNotFound) return "This purchase order no longer exists.";
    if (e.code === "DEPENDENCY_UNAVAILABLE") {
      return "Document storage is temporarily unavailable. Try again in a moment.";
    }
  }
  return getErrorMessage(e);
}

/**
 * The demo-document helper for the invoice upload area
 * (backend-docs/documents-api.md): generates a supplier invoice PDF from the
 * PO's own data so a demo operator has something to download and re-upload
 * through the real upload flow below, without needing an outside PDF.
 * Rendered as its own document — never a StatusBadge — since a GENERATED
 * invoice never enters matching and must not be mistaken for a pipeline
 * invoice (see the sibling, UPLOADED-only invoice list).
 */
export function GeneratedInvoicePanel({
  requisitionId,
  purchaseOrder,
  generatedInvoice,
  isLoading,
  disabled,
}: GeneratedInvoicePanelProps) {
  const generate = useGenerateInvoice();
  const download = useDownloadDocument();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lines, setLines] = useState<GenerateInvoiceRawLine[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const openDialog = () => {
    setLines(
      purchaseOrder.items.map((item) => ({ purchaseOrderItemId: item.id, quantity: "" }))
    );
    setFieldErrors({});
    generate.reset();
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFieldErrors({});
    generate.reset();
  };

  const handleLineQuantityChange = (purchaseOrderItemId: string, value: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.purchaseOrderItemId === purchaseOrderItemId ? { ...line, quantity: value } : line
      )
    );
    setFieldErrors((prev) => ({ ...prev, [purchaseOrderItemId]: "" }));
  };

  const runGenerate = (items?: { purchaseOrderItemId: string; quantity: number }[]) => {
    generate.mutate(
      { purchaseOrderId: purchaseOrder.id, requisitionId, items },
      {
        onSuccess: (invoice) => {
          toast.success("Demo invoice ready — downloading…");
          closeDialog();
          download.mutate({
            fetcher: () => getInvoicePdf(invoice.id),
            fallbackFilename: `invoice-${invoice.invoiceNumber ?? invoice.id}.pdf`,
          });
        },
        onError: (e) => {
          if (e instanceof ApiError && (e.isConflict || e.isNotFound)) {
            toast.error(generateErrorToastMessage(e));
            closeDialog();
            return;
          }
          // Validation errors stay inline via the dialog's InlineError — no
          // toast, to avoid double-reporting. That only applies while the
          // dialog is open to render it; the no-dialog "Generate demo
          // invoice" button has nowhere else to surface the error.
          if (!(dialogOpen && e instanceof ApiError && e.isValidation)) {
            toast.error(generateErrorToastMessage(e));
          }
        },
      }
    );
  };

  const isBusy = generate.isPending || download.isPending;

  const handleGenerateDefault = () => {
    if (disabled || isBusy) return;
    runGenerate(undefined);
  };

  const handleConfirmCustom = () => {
    if (isBusy) return;
    const result = validateGenerateInvoiceOverrides(lines, purchaseOrder.items);
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    runGenerate(result.overrides.length > 0 ? result.overrides : undefined);
  };

  if (isLoading) {
    return <SkeletonLines lines={2} />;
  }

  if (generatedInvoice) {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium">
              Demo document · {generatedInvoice.invoiceNumber ?? `Invoice ${generatedInvoice.id.slice(0, 8)}…`}
            </p>
            {generatedInvoice.totalPaise != null && (
              <p className="text-xs text-muted-foreground">
                <Money paise={generatedInvoice.totalPaise} />
              </p>
            )}
          </div>
          <DocumentActions
            fetcher={() => getInvoicePdf(generatedInvoice.id)}
            fallbackFilename={`invoice-${generatedInvoice.invoiceNumber ?? generatedInvoice.id}.pdf`}
            title={generatedInvoice.invoiceNumber ?? "Demo invoice"}
            size="xs"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Download it, then upload it below to run three-way matching. This document is not
          matched or paid itself.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || isBusy}
        onClick={handleGenerateDefault}
        className="gap-1.5"
      >
        {isBusy && <Spinner size="sm" />}
        Generate demo invoice
      </Button>
      <Button variant="ghost" size="sm" disabled={disabled || isBusy} onClick={openDialog}>
        Customize quantities
      </Button>

      <GenerateInvoiceDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        poItems={purchaseOrder.items}
        lines={lines}
        onLineQuantityChange={handleLineQuantityChange}
        fieldErrors={fieldErrors}
        isPending={isBusy}
        error={generate.error}
        onConfirm={handleConfirmCustom}
      />
    </div>
  );
}
