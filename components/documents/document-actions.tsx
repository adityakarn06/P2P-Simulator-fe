"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/loading-state";
import { DocumentViewerDialog } from "@/components/documents/document-viewer-dialog";
import { useDownloadDocument, useDocumentPreview } from "@/hooks/use-documents";
import type { BinaryResponse } from "@/lib/api/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, Download01Icon } from "@/lib/icons";

interface DocumentActionsProps {
  /** Bound fetcher for one of getPurchaseOrderPdf / getReceiptPdf / getInvoicePdf. */
  fetcher: () => Promise<BinaryResponse>;
  /** Used for the saved filename when Content-Disposition is missing. */
  fallbackFilename: string;
  /** Shown in the viewer dialog's title. */
  title: string;
  disabled?: boolean;
  size?: "sm" | "xs";
}

/**
 * The reusable View/Download pair for the three /pdf document endpoints
 * (backend-docs/documents-api.md). View opens DocumentViewerDialog, which
 * owns its own fetch; Download runs independently through
 * useDownloadDocument so opening the viewer first isn't required to save
 * the file.
 */
export function DocumentActions({
  fetcher,
  fallbackFilename,
  title,
  disabled,
  size = "sm",
}: DocumentActionsProps) {
  const preview = useDocumentPreview(fetcher);
  const download = useDownloadDocument();

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          onClick={preview.open}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={EyeIcon} />
          View
        </Button>
        <Button
          variant="outline"
          size={size}
          disabled={disabled || download.isPending}
          onClick={() => download.mutate({ fetcher, fallbackFilename })}
          className="gap-1.5"
        >
          {download.isPending ? <Spinner size="sm" /> : <HugeiconsIcon icon={Download01Icon} />}
          Download
        </Button>
      </div>

      <DocumentViewerDialog
        title={title}
        open={preview.isOpen}
        onOpenChange={(open) => (open ? preview.open() : preview.close())}
        isLoading={preview.isLoading}
        error={preview.error}
        objectUrl={preview.objectUrl}
        mimeType={preview.mimeType}
        filename={preview.filename ?? fallbackFilename}
        onDownload={() => download.mutate({ fetcher, fallbackFilename })}
        isDownloading={download.isPending}
      />
    </>
  );
}
