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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import { Money } from "@/components/common/money";
import {
  formatPaiseInput,
  getMaxApprovableAmountPaise,
} from "@/lib/state/exception-state";
import { cn } from "@/lib/utils";
import type { ExceptionDecision, ExceptionSettlement } from "@/types/models";

interface ResolveExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: ExceptionDecision;
  /** Title of the exception being resolved, shown in the description */
  exceptionTitle: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  validationError: string | null;
  /** The rupee string in the amount field. Only read for PARTIAL_APPROVE. */
  approvedAmount: string;
  onApprovedAmountChange: (amount: string) => void;
  approvedAmountError: string | null;
  /** The invoice/PO ledger. Required in practice for PARTIAL_APPROVE. */
  settlement: ExceptionSettlement | null;
  onConfirm: () => void;
  isPending?: boolean;
  error?: unknown;
}

const COPY: Record<ExceptionDecision, { title: string; confirm: string }> = {
  APPROVE: { title: "Approve exception", confirm: "Approve" },
  PARTIAL_APPROVE: { title: "Approve a partial payment", confirm: "Approve amount" },
  REJECT: { title: "Reject exception", confirm: "Reject" },
};

function describe(decision: ExceptionDecision, title: string): string {
  switch (decision) {
    case "APPROVE":
      return `Approve: "${title}". The invoice will be settled as billed. If this is the last open exception on the invoice, payment is released automatically.`;
    case "PARTIAL_APPROVE":
      return `Approve a specific amount against: "${title}". The invoice becomes Partially Paid and the purchase order keeps its remaining balance, so a follow-up invoice for the rest can still be matched.`;
    case "REJECT":
      return `Reject: "${title}". Nothing is released for payment.`;
  }
}

/**
 * Records a human decision on an exception (APPROVE, PARTIAL_APPROVE or REJECT).
 *
 * Per backend-docs/exceptions-api.md: `reason` is required, 10–1000 chars —
 * "this is a financial judgement" and the backend refuses a resolution with no
 * real explanation. One component serves all three decisions; only
 * PARTIAL_APPROVE shows the amount field, because sending an amount with the
 * other two is a 400.
 */
export function ResolveExceptionDialog({
  open,
  onOpenChange,
  decision,
  exceptionTitle,
  reason,
  onReasonChange,
  validationError,
  approvedAmount,
  onApprovedAmountChange,
  approvedAmountError,
  settlement,
  onConfirm,
  isPending = false,
  error,
}: ResolveExceptionDialogProps) {
  const isPartial = decision === "PARTIAL_APPROVE";
  const isReject = decision === "REJECT";
  const copy = COPY[decision];

  const suggestedPaise = settlement?.suggestedAmountPaise ?? null;
  const suggestedString = suggestedPaise != null ? formatPaiseInput(suggestedPaise) : null;
  const isSuggested = suggestedString != null && approvedAmount.trim() === suggestedString;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{describe(decision, exceptionTitle)}</DialogDescription>
        </DialogHeader>

        {isPartial && settlement && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Invoice outstanding</dt>
                <dd>
                  <Money paise={settlement.invoiceOutstandingPaise} className="text-sm" />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">PO outstanding</dt>
                <dd>
                  <Money
                    paise={settlement.purchaseOrderOutstandingPaise}
                    className="text-sm"
                  />
                </dd>
              </div>
            </dl>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="approved-amount">Amount to approve (₹)</Label>
                {suggestedString != null && !isSuggested && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1.5 py-0.5 text-xs"
                    disabled={isPending}
                    onClick={() => onApprovedAmountChange(suggestedString)}
                  >
                    Use suggested
                  </Button>
                )}
              </div>
              <Input
                id="approved-amount"
                inputMode="decimal"
                value={approvedAmount}
                onChange={(e) => onApprovedAmountChange(e.target.value)}
                disabled={isPending}
                placeholder="0.00"
                aria-invalid={approvedAmountError != null}
                aria-describedby={
                  approvedAmountError ? "approved-amount-error" : "approved-amount-hint"
                }
              />
              {approvedAmountError ? (
                <p id="approved-amount-error" role="alert" className="text-xs text-destructive">
                  {approvedAmountError}
                </p>
              ) : (
                <p id="approved-amount-hint" className="text-xs text-muted-foreground">
                  {suggestedPaise != null ? (
                    <>
                      Suggested <Money paise={suggestedPaise} /> — accepted units at the
                      purchase order&rsquo;s agreed price, so an inflated invoice price is
                      not inherited. Maximum{" "}
                      <Money paise={getMaxApprovableAmountPaise(settlement)} />.
                    </>
                  ) : (
                    <>
                      Maximum <Money paise={getMaxApprovableAmountPaise(settlement)} />.
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="resolve-reason">Reason</Label>
          <textarea
            id="resolve-reason"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
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
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={isReject ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Spinner size="sm" />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
