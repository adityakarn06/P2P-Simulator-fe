"use client";

import { useState } from "react";
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
import { resolveReasonSchema } from "@/features/exceptions/lib/exception-state";
import type { ExceptionDecision } from "@/types/models";

interface ResolveExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: ExceptionDecision;
  /** Title of the exception being resolved, shown in the description */
  exceptionTitle: string;
  onConfirm: (reason: string) => void;
  isPending?: boolean;
  error?: unknown;
}

/**
 * Records a human decision on an exception (APPROVE or REJECT).
 * Per backend-docs/exceptions-api.md: `reason` is required, 10–1000 chars —
 * "this is a financial judgement" and the backend refuses a resolution with
 * no real explanation. One component serves both decisions.
 */
export function ResolveExceptionDialog({
  open,
  onOpenChange,
  decision,
  exceptionTitle,
  onConfirm,
  isPending = false,
  error,
}: ResolveExceptionDialogProps) {
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const isApprove = decision === "APPROVE";

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason("");
      setValidationError(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = () => {
    const result = resolveReasonSchema.safeParse(reason);
    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "Invalid reason.");
      return;
    }
    setValidationError(null);
    onConfirm(result.data);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approve exception" : "Reject exception"}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Approve: "${exceptionTitle}". If this is the last open exception on the invoice, payment will be released automatically.`
              : `Reject: "${exceptionTitle}". The invoice stays blocked — there is no way to reopen this exception afterward.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="resolve-reason">Reason</Label>
          <textarea
            id="resolve-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (validationError) setValidationError(null);
            }}
            maxLength={1000}
            rows={4}
            disabled={isPending}
            placeholder="Explain the decision for the audit trail (10–1000 characters)…"
            aria-invalid={validationError != null}
            aria-describedby={validationError ? "resolve-reason-error" : undefined}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
              validationError && "border-destructive"
            )}
          />
          {validationError && (
            <p id="resolve-reason-error" role="alert" className="text-xs text-destructive">
              {validationError}
            </p>
          )}
          {error != null && <InlineError error={error} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={isApprove ? "default" : "destructive"}
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Spinner size="sm" />}
            {isApprove ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
