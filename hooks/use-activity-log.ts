"use client";

import { useMemo } from "react";
import { useInfiniteAuditLogs } from "@/hooks/use-audit-logs";
import { useActivityStore, ACTIVITY_FILTER_ALL } from "@/store/activity-store";

export function useActivityLog() {
  const actorType = useActivityStore((s) => s.actorType);
  const entityType = useActivityStore((s) => s.entityType);
  const action = useActivityStore((s) => s.action);
  const setActorType = useActivityStore((s) => s.setActorType);
  const setEntityType = useActivityStore((s) => s.setEntityType);
  const setAction = useActivityStore((s) => s.setAction);

  const filters = useMemo(
    () => ({
      limit: 50,
      actorType: actorType === ACTIVITY_FILTER_ALL ? undefined : actorType,
      entityType: entityType === ACTIVITY_FILTER_ALL ? undefined : entityType,
      action: action === ACTIVITY_FILTER_ALL ? undefined : action,
    }),
    [actorType, entityType, action]
  );

  const query = useInfiniteAuditLogs(filters, {
    // Poll only while a single page is loaded — the doc's "poll if you need
    // a live activity feed" without re-fetching every accumulated page.
    refetchInterval: (q) => ((q.state.data?.pages.length ?? 1) <= 1 ? 10_000 : false),
  });

  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    actorType,
    entityType,
    action,
    setActorType,
    setEntityType,
    setAction,
    rows,
    ...query,
  };
}
