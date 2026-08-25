import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  listExceptions,
  getException,
  resolveException,
  type ListExceptionsParams,
  type ResolveExceptionBody,
  type ResolveExceptionResponse,
} from "@/lib/api/exceptions";
import type { EntityType, Exception } from "@/types/models";
import { ApiError, type CursorPaginatedData } from "@/types/api";
import { invoiceKeys } from "@/hooks/use-invoices";

export const exceptionKeys = {
  all: ["exceptions"] as const,
  lists: () => [...exceptionKeys.all, "list"] as const,
  list: (filters: ListExceptionsParams) =>
    [...exceptionKeys.lists(), filters] as const,
  details: () => [...exceptionKeys.all, "detail"] as const,
  detail: (id: string) => ["exception", id] as const,
} as const;

/**
 * Lists exceptions (exceptions inbox), newest first.
 * Query key: ["exceptions", "list", filters]
 *
 * Suggested usage:
 *   - `status=OPEN` for an exceptions inbox screen.
 *   - `entityId={invoiceId}&status=OPEN` to see what's blocking one invoice.
 */
export function useExceptions(
  filters: ListExceptionsParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<Exception>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<Exception>>({
    queryKey: exceptionKeys.list(filters),
    queryFn: () => listExceptions(filters),
    ...options,
  });
}

/**
 * Fetches a single exception by id.
 * Query key: ["exception", id]
 */
export function useException(
  id: string,
  options?: Omit<UseQueryOptions<Exception>, "queryKey" | "queryFn">
) {
  return useQuery<Exception>({
    queryKey: exceptionKeys.detail(id),
    queryFn: () => getException(id),
    enabled: Boolean(id),
    ...options,
  });
}

export interface ResolveExceptionVariables extends ResolveExceptionBody {
  id: string;
  /** The exception's own entity — threaded through purely for cache invalidation. */
  entityType: EntityType;
  entityId: string;
}

/**
 * Invalidates the exception detail/lists, plus — when the exception targets
 * an Invoice — that invoice's detail/list queries, since resolving may have
 * moved it EXCEPTION → APPROVED (see `releasedForPayment` on the response).
 * Both invoiceKeys.detail() and exceptionKeys.detail() are flat keys, not
 * reached by invalidating `.all`/`.lists()`, so each is invalidated
 * explicitly — mirrors invalidateAfterUpload in hooks/use-invoices.ts.
 */
function invalidateAfterResolve(
  queryClient: ReturnType<typeof useQueryClient>,
  variables: ResolveExceptionVariables
) {
  queryClient.invalidateQueries({
    queryKey: exceptionKeys.detail(variables.id),
  });
  queryClient.invalidateQueries({ queryKey: exceptionKeys.lists() });
  if (variables.entityType === "Invoice") {
    queryClient.invalidateQueries({
      queryKey: invoiceKeys.detail(variables.entityId),
    });
    queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
  }
}

/**
 * Resolves an exception (APPROVE or REJECT).
 * Disable the UI once exception.status is RESOLVED or REJECTED — re-resolving returns 409.
 *
 * On success:
 * - Invalidates the specific exception detail.
 * - Invalidates all exceptions lists (to refresh the inbox and per-invoice views).
 * - If the exception targets an Invoice, also invalidates that invoice's
 *   detail/list queries — if `releasedForPayment` is true, the invoice has
 *   moved EXCEPTION → APPROVED; start/keep polling useInvoice(id) for PAID.
 *
 * On a 409 (someone else already decided this — see backend-docs/exceptions-api.md,
 * "treat a 409 here as 'someone else already decided this, refetch it'"),
 * the same invalidation runs so the UI reflects the real, current state
 * instead of showing a stale row next to an error toast.
 */
export function useResolveException() {
  const queryClient = useQueryClient();

  return useMutation<
    ResolveExceptionResponse,
    Error,
    ResolveExceptionVariables
  >({
    mutationFn: ({ id, decision, reason }) =>
      resolveException(id, { decision, reason }),
    onSuccess: (_data, variables) => invalidateAfterResolve(queryClient, variables),
    onError: (error, variables) => {
      if (error instanceof ApiError && error.isConflict) {
        invalidateAfterResolve(queryClient, variables);
      }
    },
  });
}
