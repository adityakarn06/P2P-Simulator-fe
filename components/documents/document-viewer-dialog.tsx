"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/common/error-state";
import { SkeletonLines, Spinner } from "@/components/common/loading-state";
import { isPreviewableMimeType } from "@/lib/documents";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@/lib/icons";

interface DocumentViewerDialogProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  error: unknown;
  objectUrl: string | null;
  mimeType: string | null;
  filename: string;
  onDownload: () => void;
  isDownloading: boolean;
}

/**
 * Renders whatever the document endpoint actually streamed — application/pdf in an
 * iframe, image/png|jpeg (an uploaded scan) as an <img>, anything else
 * falls back to a Download-only message. See backend-docs/documents-api.md:
 * an /invoices/:id/pdf response's Content-Type follows the file's stored
 * MIME type, not a hardcoded application/pdf.
 */
export function DocumentViewerDialog({
  title,
  open,
  onOpenChange,
  isLoading,
  error,
  objectUrl,
  mimeType,
  filename,
  onDownload,
  isDownloading,
}: DocumentViewerDialogProps) {
  const kind = mimeType ? isPreviewableMimeType(mimeType) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-[50vh]">
          {isLoading && <SkeletonLines className="p-4" />}

          {!isLoading && error != null && <InlineError error={error} className="p-4" />}

          {!isLoading && error == null && objectUrl && kind === "pdf" && (
            <iframe title={filename} src={objectUrl} className="h-[70vh] w-full rounded-md border" />
          )}

          {!isLoading && error == null && objectUrl && kind === "image" && (
            <div className="max-h-[70vh] overflow-auto rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: object URL can't go through next/image */}
              <img src={objectUrl} alt={filename} className="w-full" />
            </div>
          )}

          {!isLoading && error == null && objectUrl && kind === "unsupported" && (
            <p className="p-4 text-sm text-muted-foreground">
              This file type can&apos;t be previewed here. Download it to view it.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={onDownload} disabled={isDownloading} className="gap-1.5">
            {isDownloading ? <Spinner size="sm" /> : <HugeiconsIcon icon={Download01Icon} />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
