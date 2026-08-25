import {
  useQuery,
  useInfiniteQuery,
  type UseQueryOptions,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  listAuditLogs,
  type ListAuditLogsParams,
} from "@/lib/api/audit-logs";
import type { AuditLog } from "@/types/models";
import type { CursorPaginatedData } from "@/types/api";

export const auditLogKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditLogKeys.all, "list"] as const,
  list: (filters: ListAuditLogsParams) =>
    [...auditLogKeys.lists(), filters] as const,
} as const;

/**
 * Fetches a single page of the audit trail.
 * Query key: ["audit-logs", "list", filters]
 */
export function useAuditLogs(
  filters: ListAuditLogsParams = {},
  options?: Omit<
    UseQueryOptions<CursorPaginatedData<AuditLog>>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery<CursorPaginatedData<AuditLog>>({
    queryKey: auditLogKeys.list(filters),
    queryFn: () => listAuditLogs(filters),
    ...options,
  });
}

type AuditLogPage = CursorPaginatedData<AuditLog>;
type AuditLogQueryKey = readonly [...ReturnType<typeof auditLogKeys.list>, "infinite"];

interface UseInfiniteAuditLogsOptions {
  /** Same shape react-query's refetchInterval accepts on an infinite query. */
  refetchInterval?:
    | number
    | false
    | ((query: {
        state: { data?: InfiniteData<AuditLogPage, string | undefined> };
      }) => number | false);
  enabled?: boolean;
}

/**
 * Cursor-paginated activity feed with "load more" support.
 * Query key: ["audit-logs", "list", filters, "infinite"]
 */
export function useInfiniteAuditLogs(
  filters: ListAuditLogsParams = {},
  options?: UseInfiniteAuditLogsOptions
) {
  return useInfiniteQuery<
    AuditLogPage,
    Error,
    InfiniteData<AuditLogPage, string | undefined>,
    AuditLogQueryKey,
    string | undefined
  >({
    queryKey: [...auditLogKeys.list(filters), "infinite"] as const,
    queryFn: ({ pageParam }) =>
      listAuditLogs({ ...filters, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    ...options,
  });
}
