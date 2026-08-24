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
import type { Exception } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

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

/**
 * Resolves an exception (APPROVE or REJECT).
 * Disable the UI once exception.status is RESOLVED or REJECTED — re-resolving returns 409.
 *
 * On success:
 * - Invalidates the specific exception detail.
 * - Invalidates all exceptions lists (to refresh the inbox and per-invoice views).
 * - If `releasedForPayment` is true, the invoice has moved EXCEPTION → APPROVED;
 *   you should also invalidate the invoice query and start/keep polling for PAID.
 */
export function useResolveException() {
  const queryClient = useQueryClient();

  return useMutation<
    ResolveExceptionResponse,
    Error,
    { id: string } & ResolveExceptionBody
  >({
    mutationFn: ({ id, decision, reason }) =>
      resolveException(id, { decision, reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: exceptionKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: exceptionKeys.lists() });
    },
  });
}
