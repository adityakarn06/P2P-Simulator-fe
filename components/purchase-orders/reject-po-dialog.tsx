"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import { cn } from "@/lib/utils";

interface RejectPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  validationError: string | null;
  onConfirm: () => void;
  isPending?: boolean;
  error?: unknown;
}

export function RejectPoDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  validationError,
  onConfirm,
  isPending = false,
  error,
}: RejectPoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject purchase order</DialogTitle>
          <DialogDescription>
            This requisition will move to Failed and can no longer be actioned. Provide a
            reason for the record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Reason</Label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={isPending}
            placeholder="e.g. Budget exceeded, wrong supplier selected…"
            className={cn(
              "w-full resize-none rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
              validationError && "border-destructive"
            )}
          />
          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
          {error != null && <InlineError error={error} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Spinner size="sm" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
