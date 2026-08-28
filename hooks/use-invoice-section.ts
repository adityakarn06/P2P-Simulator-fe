"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useInvoices, useUploadInvoice } from "@/hooks/use-invoices";
import { validateInvoiceFile } from "@/lib/state/invoice-state";
import { getErrorMessage } from "@/lib/errors";
import { ApiError } from "@/types/api";
import type { PurchaseOrder, PurchaseOrderItem } from "@/types/models";

/**
 * Shared toast copy for a failed invoice upload, mirroring
 * receiptErrorToastMessage in use-shipment-section.ts so the same error
 * kinds read the same way across the workflow.
 */
function invoiceErrorToastMessage(e: unknown): string {
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
 * Fetches every invoice for the purchase order and owns the upload dialog:
 * the selected file, its client-side validation error, and the mutation.
 *
 * Dialog state is local — ephemeral, single-consumer UI state with no
 * cross-component readers, same rationale as useShipmentSection.
 */
export function useInvoiceSection(
  requisitionId: string,
  purchaseOrder: Pick<PurchaseOrder, "id"> & {
    items: Pick<PurchaseOrderItem, "id" | "description" | "quantity">[];
  }
) {
  // UPLOADED-only — the real, matched invoice(s). A GENERATED demo document
  // (backend-docs/documents-api.md) is fetched separately below and rendered
  // by GeneratedInvoicePanel, never in this list, since it never enters
  // matching and must not be mistaken for a pipeline invoice.
  const invoices = useInvoices({
    purchaseOrderId: purchaseOrder.id,
    source: "UPLOADED",
    limit: 50,
  });
  const generatedInvoices = useInvoices({
    purchaseOrderId: purchaseOrder.id,
    source: "GENERATED",
    limit: 1,
  });
  const upload = useUploadInvoice();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const actionsDisabled = upload.isPending;

  const openDialog = () => {
    setFile(null);
    setFileError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFile(null);
    setFileError(null);
    upload.reset();
  };

  const onDialogChange = (open: boolean) => {
    if (!open) {
      closeDialog();
    } else {
      setDialogOpen(true);
    }
  };

  const handleFileChange = (next: File | null) => {
    setFile(next);
    setFileError(null);
  };

  const handleUpload = () => {
    if (actionsDisabled) return;

    const result = validateInvoiceFile(file);
    if (!result.ok) {
      setFileError(result.error);
      return;
    }
    setFileError(null);

    upload.mutate(
      {
        file: result.file,
        purchaseOrderId: purchaseOrder.id,
        requisitionId,
      },
      {
        onSuccess: () => {
          toast.success("Invoice uploaded — extracting…");
          closeDialog();
        },
        onError: (e) => {
          if (e instanceof ApiError && (e.isConflict || e.isNotFound)) {
            toast.error(invoiceErrorToastMessage(e));
            closeDialog();
            return;
          }
          // Validation errors (400 from the backend's byte-sniffing check)
          // stay inline via InlineError — no toast, to avoid double-reporting
          // the same message. A DEPENDENCY_UNAVAILABLE / network error keeps
          // the dialog open with the file still selected so retry is one click.
          if (!(e instanceof ApiError && e.isValidation)) {
            toast.error(invoiceErrorToastMessage(e));
          }
        },
      }
    );
  };

  return {
    invoices,
    generatedInvoice: generatedInvoices.data?.items[0],
    isGeneratedInvoiceLoading: generatedInvoices.isLoading,
    dialogOpen,
    openDialog,
    onDialogChange,
    file,
    setFile: handleFileChange,
    fileError,
    actionsDisabled,
    handleUpload,
    upload,
  };
}
