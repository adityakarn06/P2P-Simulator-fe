"use client";

import { useRef, type DragEvent, type KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/formatters";
import { INVOICE_FILE_ACCEPT } from "@/lib/state/invoice-state";
import { HugeiconsIcon } from "@hugeicons/react";
import { File01Icon, MultiplicationSignCircleIcon, Invoice01Icon } from "@/lib/icons";

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  fileError: string | null;
  onConfirm: () => void;
  isPending?: boolean;
  error?: unknown;
}

export function InvoiceUploadDialog({
  open,
  onOpenChange,
  file,
  onFileChange,
  fileError,
  onConfirm,
  isPending = false,
  error,
}: InvoiceUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (isPending) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files?.[0] ?? null);
    // Reset so choosing the same file again still fires onChange.
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isPending) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileChange(dropped);
  };

  const handleDropZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pickFile();
    }
  };

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && inputRef.current) {
      inputRef.current.value = "";
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload invoice</DialogTitle>
          <DialogDescription>
            PDF, PNG or JPEG · up to 10 MB. Extraction runs automatically once it&apos;s uploaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept={INVOICE_FILE_ACCEPT}
            onChange={handleInputChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {file ? (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border p-3",
                fileError && "border-destructive"
              )}
            >
              <HugeiconsIcon icon={File01Icon} className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove selected file"
                aria-describedby={fileError ? "invoice-file-error" : undefined}
                disabled={isPending}
                onClick={() => onFileChange(null)}
              >
                <HugeiconsIcon icon={MultiplicationSignCircleIcon} className="size-4" />
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose an invoice file"
              aria-describedby={fileError ? "invoice-file-error" : undefined}
              onClick={pickFile}
              onKeyDown={handleDropZoneKeyDown}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                fileError && "border-destructive"
              )}
            >
              <HugeiconsIcon icon={Invoice01Icon} className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">Click to choose a file, or drag it here</p>
              <p className="text-xs text-muted-foreground">PDF, PNG or JPEG · up to 10 MB</p>
            </div>
          )}

          {fileError && (
            <p id="invoice-file-error" role="alert" className="text-xs text-destructive">
              {fileError}
            </p>
          )}
          {error != null && !fileError && <InlineError error={error} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDialogChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isPending || file == null} className="gap-1.5">
            {isPending && <Spinner size="sm" />}
            Upload Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
