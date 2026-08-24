"use client";

import { useState } from "react";
import { z } from "zod";
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
import { InlineError } from "@/components/error-state";
import { Spinner } from "@/components/loading-state";
import { cn } from "@/lib/utils";

// Mirrors backend-docs/purchase-orders-api.md: reason is required, 1–500 chars.
const rejectReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(500, "Reason must be 500 characters or fewer.");

interface RejectPoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  error?: unknown;
}

export function RejectPoDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  error,
}: RejectPoDialogProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    const result = rejectReasonSchema.safeParse(reason);
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "Invalid reason.");
      return;
    }
    setValidationError(null);
    onConfirm(result.data);
  };

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
            onChange={(e) => {
              setReason(e.target.value);
              if (validationError) setValidationError(null);
            }}
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
            onClick={handleConfirm}
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
