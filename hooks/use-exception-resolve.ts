"use client";

import { toast } from "sonner";
import { useResolveException } from "@/hooks/use-exceptions";
import { useExceptionStore } from "@/store/exception-store";
import { resolveReasonSchema } from "@/lib/state/exception-state";
import { ApiError } from "@/types/api";
import type { Exception, ExceptionDecision } from "@/types/models";

/**
 * Records a human decision (APPROVE or REJECT) on a single exception row.
 * Per backend-docs/exceptions-api.md: `reason` is required, 10–1000 chars —
 * "this is a financial judgement" and the backend refuses a resolution with
 * no real explanation.
 */
export function useExceptionResolve(exception: Exception) {
  const pendingDecision = useExceptionStore((s) => s.pendingDecisions[exception.id] ?? null);
  const setPendingDecision = useExceptionStore((s) => s.setPendingDecision);
  const reason = useExceptionStore((s) => s.resolveReason);
  const setReason = useExceptionStore((s) => s.setResolveReason);
  const reasonError = useExceptionStore((s) => s.resolveReasonError);
  const setReasonError = useExceptionStore((s) => s.setResolveReasonError);
  const resetResolveForm = useExceptionStore((s) => s.resetResolveForm);

  const { mutate, isPending, error, reset, data } = useResolveException();

  const openDecision = (decision: ExceptionDecision) => setPendingDecision(exception.id, decision);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPendingDecision(exception.id, null);
      resetResolveForm();
      reset();
    }
  };

  const handleConfirm = () => {
    if (!pendingDecision) return;
    const result = resolveReasonSchema.safeParse(reason);
    if (!result.success) {
      setReasonError(result.error.issues[0]?.message ?? "Invalid reason.");
      return;
    }
    setReasonError(null);
    mutate(
      {
        id: exception.id,
        entityType: exception.entityType,
        entityId: exception.entityId,
        decision: pendingDecision,
        reason: result.data,
      },
      {
        onSuccess: (data) => {
          if (data.releasedForPayment) {
            toast.success("Exception approved — payment released");
          } else {
            toast.success(
              pendingDecision === "APPROVE" ? "Exception approved" : "Exception rejected"
            );
          }
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
