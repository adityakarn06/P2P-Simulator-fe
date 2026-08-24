import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  createRequisition,
  sendRequisitionMessage,
  getRequisition,
  listRequisitions,
  type CreateRequisitionBody,
  type SendRequisitionMessageBody,
  type ListRequisitionsParams,
} from "@/lib/api/requisitions";
import type { Requisition, RequisitionChatResult, RequisitionListItem } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export const requisitionKeys = {
  all: ["requisitions"] as const,
  lists: () => [...requisitionKeys.all, "list"] as const,
  list: (filters: ListRequisitionsParams) =>
    [...requisitionKeys.lists(), filters] as const,
  details: () => [...requisitionKeys.all, "detail"] as const,
  detail: (id: string) => ["requisition", id] as const,
} as const;

/**
 * Fetches a single requisition by id.
 * Query key: ["requisition", id]
 *
 * Use this for the main detail/poll loop — it includes messages, sourcing,
 * supplierCandidates, and purchaseOrder as they are populated.
 */
export function useRequisition(
  id: string,
  options?: Omit<UseQueryOptions<Requisition>, "queryKey" | "queryFn">
) {
  return useQuery<Requisition>({
    queryKey: requisitionKeys.detail(id),
    queryFn: () => getRequisition(id),
    enabled: Boolean(id),
    ...options,
  });
}

/**
 * Lists requisitions for the current organisation, most recent first.
 * Query key: ["requisitions", "list", filters]
 */
export function useRequisitions(
  filters: ListRequisitionsParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<RequisitionListItem>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<RequisitionListItem>>({
    queryKey: requisitionKeys.list(filters),
    queryFn: () => listRequisitions(filters),
    ...options,
  });
}


/**
 * Creates a new requisition from a free-form message.
 * On success, invalidates the requisitions list so it refreshes.
 */
export function useCreateRequisition() {
  const queryClient = useQueryClient();

  return useMutation<RequisitionChatResult, Error, CreateRequisitionBody>({
    mutationFn: createRequisition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() });
    },
  });
}

/**
 * Sends a follow-up message to an existing requisition.
 * On success, invalidates the detail query so the transcript refreshes.
 */
export function useSendRequisitionMessage() {
  const queryClient = useQueryClient();

  return useMutation<
    RequisitionChatResult,
    Error,
    { id: string } & SendRequisitionMessageBody
  >({
    mutationFn: ({ id, input }) =>
      sendRequisitionMessage(id, { input }),
    onSuccess: (_data, variables) =>
      // Returned so the mutation stays pending until the refetched detail is
      // in cache — callers rely on isPending spanning the whole round trip.
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: requisitionKeys.detail(variables.id),
        }),
        // requisitionKeys.detail() is deliberately not nested under .all, so
        // the list's status/turnCount/updatedAt columns need an explicit
        // invalidation too.
        queryClient.invalidateQueries({ queryKey: requisitionKeys.lists() }),
      ]),
  });
}
