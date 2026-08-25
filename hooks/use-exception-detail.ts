"use client";

import { useException, useExceptions } from "@/hooks/use-exceptions";
import { isInvoiceException } from "@/lib/state/exception-state";

/**
 * Composes everything the /exceptions/[id] screen needs: the exception
 * itself, plus — when it blocks an Invoice — the invoice's other still-open
 * exceptions (per backend-docs/exceptions-api.md: "An invoice can have more
 * than one exception… keep the invoice's remaining open exceptions visible").
 *
 * Resolve-dialog state/mutation is not composed here — it needs a *loaded*
 * Exception (useExceptionResolve reads exception.id/entityType/entityId),
 * so the page calls it directly once `exception` exists, the same way the
 * inbox's ResolveActions does per row.
 *
 * No polling here — an exception only changes when a human resolves it (or
 * another tab does), and useResolveException's invalidation covers both.
 */
export function useExceptionDetail(id: string) {
  const exceptionQuery = useException(id);
  const exception = exceptionQuery.data;

  const relatedOpenQuery = useExceptions(
    { entityId: exception?.entityId, status: "OPEN", limit: 50 },
    { enabled: Boolean(exception) && isInvoiceException(exception ?? { entityType: "Exception" }) }
  );

  // Exclude the current exception from "still blocking this invoice" — it's
  // shown by the page itself, not the related-exceptions panel.
  const relatedOpenExceptions = (relatedOpenQuery.data?.items ?? []).filter(
    (e) => e.id !== id
  );

  return {
    exception,
    isLoading: exceptionQuery.isLoading,
    isError: exceptionQuery.isError,
    error: exceptionQuery.error,
    refetch: exceptionQuery.refetch,
    relatedOpenExceptions,
    isRelatedLoading: relatedOpenQuery.isLoading,
  };
}
