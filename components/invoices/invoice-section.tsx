"use client";

import { Button } from "@/components/ui/button";
import { SkeletonLines } from "@/components/common/loading-state";
import { InlineError } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { useInvoiceSection } from "@/hooks/use-invoice-section";
import { InvoiceUploadDialog } from "@/components/invoices/invoice-upload-dialog";
import { InvoiceRow } from "@/components/invoices/invoice-row";
import { canUploadInvoice } from "@/lib/state/invoice-state";
import { Invoice01Icon } from "@/lib/icons";
import type { PurchaseOrder } from "@/types/models";

interface InvoiceSectionProps {
  requisitionId: string;
  purchaseOrder: Pick<PurchaseOrder, "id" | "status">;
}

export function InvoiceSection({ requisitionId, purchaseOrder }: InvoiceSectionProps) {
  const {
    invoices,
    dialogOpen,
    openDialog,
    onDialogChange,
    file,
    setFile,
    fileError,
    actionsDisabled,
    handleUpload,
    upload,
  } = useInvoiceSection(requisitionId, purchaseOrder);

  const uploadEnabled = canUploadInvoice(purchaseOrder);

  return (
    <div className="space-y-4">
      {uploadEnabled && (
        <div className="flex justify-end">
          <Button size="sm" disabled={actionsDisabled} onClick={openDialog}>
            Upload Invoice
          </Button>
        </div>
      )}

      {invoices.isLoading ? (
        <SkeletonLines />
      ) : invoices.isError ? (
        <InlineError error={invoices.error} />
      ) : !invoices.data || invoices.data.items.length === 0 ? (
        <EmptyState
          icon={Invoice01Icon}
          title="No invoice yet"
          description="Upload the supplier invoice to start three-way matching."
          className="p-6"
        />
      ) : (
        <div className="space-y-3">
          {invoices.data.items.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}

      <InvoiceUploadDialog
        open={dialogOpen}
        onOpenChange={onDialogChange}
        file={file}
        onFileChange={setFile}
        fileError={fileError}
        isPending={upload.isPending}
        error={upload.error}
        onConfirm={handleUpload}
      />
    </div>
  );
}
