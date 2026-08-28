"use client";

import { toast } from "sonner";
import { useResolveException } from "@/hooks/use-exceptions";
import { useExceptionStore } from "@/store/exception-store";
import {
  canPartialApprove,
  formatPaiseInput,
  getExceptionSettlement,
  getResolutionMessage,
  parseApprovedAmount,
  resolveReasonSchema,
} from "@/lib/state/exception-state";
import { ApiError } from "@/types/api";
import type { Exception, ExceptionDecision } from "@/types/models";

/**
 * Records a human decision (APPROVE, PARTIAL_APPROVE or REJECT) on a single
 * exception row.
 *
 * Per backend-docs/exceptions-api.md: `reason` is required, 10–1000 chars —
 * "this is a financial judgement" and the backend refuses a resolution with no
 * real explanation. `approvedAmountPaise` is required for PARTIAL_APPROVE and
 * refused for the other two, so it is validated here and assembled by
 * buildResolveBody rather than at the call site.
 */
export function useExceptionResolve(exception: Exception) {
  const pendingDecision = useExceptionStore((s) => s.pendingDecisions[exception.id] ?? null);
  const setPendingDecision = useExceptionStore((s) => s.setPendingDecision);
  const reason = useExceptionStore((s) => s.resolveReason);
  const setReason = useExceptionStore((s) => s.setResolveReason);
  const reasonError = useExceptionStore((s) => s.resolveReasonError);
  const setReasonError = useExceptionStore((s) => s.setResolveReasonError);
  const approvedAmount = useExceptionStore((s) => s.approvedAmount);
  const setApprovedAmount = useExceptionStore((s) => s.setApprovedAmount);
  const approvedAmountError = useExceptionStore((s) => s.approvedAmountError);
  const setApprovedAmountError = useExceptionStore((s) => s.setApprovedAmountError);
  const resetResolveForm = useExceptionStore((s) => s.resetResolveForm);

  const { mutate, isPending, error, reset, data } = useResolveException();

  const settlement = getExceptionSettlement(exception);
  const partialAvailable = canPartialApprove(exception);

  const openDecision = (decision: ExceptionDecision) => {
    // Prefill the backend's own "pay for what arrived" figure so the common
    // case is one click. It stays editable — a negotiated settlement is a real
    // outcome — and whatever is submitted is re-checked against both balances
    // server-side before any money moves.
    if (decision === "PARTIAL_APPROVE" && settlement?.suggestedAmountPaise != null) {
      setApprovedAmount(formatPaiseInput(settlement.suggestedAmountPaise));
    }
    setPendingDecision(exception.id, decision);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPendingDecision(exception.id, null);
      resetResolveForm();
      reset();
    }
  };

  const handleConfirm = () => {
    if (!pendingDecision) return;

    const parsedReason = resolveReasonSchema.safeParse(reason);
    if (!parsedReason.success) {
      setReasonError(parsedReason.error.issues[0]?.message ?? "Invalid reason.");
      return;
    }
    setReasonError(null);

    let approvedAmountPaise: number | undefined;
    if (pendingDecision === "PARTIAL_APPROVE") {
      // Guarded rather than assumed: the dialog only offers this decision when a
      // settlement exists, but submitting without one would be a 400 that reads
      // as a server fault instead of the missing figure it is.
      if (!settlement) {
        setApprovedAmountError("This exception has no settlement figures to pay against.");
        return;
      }
      const parsedAmount = parseApprovedAmount(approvedAmount, settlement);
      if (!parsedAmount.ok) {
        setApprovedAmountError(parsedAmount.error);
        return;
      }
      setApprovedAmountError(null);
      approvedAmountPaise = parsedAmount.paise;
    }

    mutate(
      {
        id: exception.id,
        entityType: exception.entityType,
        entityId: exception.entityId,
        decision: pendingDecision,
        reason: parsedReason.data,
        approvedAmountPaise,
      },
      {
        onSuccess: (result) => {
          toast.success(getResolutionMessage(pendingDecision, result.releasedForPayment));
          setPendingDecision(exception.id, null);
          resetResolveForm();
        },
        onError: (e) => {
          if (e instanceof ApiError && e.isConflict) {
            toast.error("This exception was already decided — refreshed.");
            setPendingDecision(exception.id, null);
            resetResolveForm();
            return;
          }
          toast.error(e.message);
        },
      }
    );
  };

  return {
    pendingDecision,
    openDecision,
    handleOpenChange,
    reason,
    setReason,
    reasonError,
    approvedAmount,
    setApprovedAmount,
    approvedAmountError,
    /** The ledger behind the amount field; null for a non-invoice exception. */
    settlement,
    /** True when the resolve UI should offer PARTIAL_APPROVE at all. */
    partialAvailable,
    handleConfirm,
    isPending,
    error,
    /**
     * Result of the most recent resolve mutation on this exception, or
     * `undefined` before any resolution has been attempted this session.
     * `releasedForPayment` on it drives the payment-status banner — see
     * components/exceptions/exception-payment-status.tsx.
     */
    resolveResult: data,
  };
}
