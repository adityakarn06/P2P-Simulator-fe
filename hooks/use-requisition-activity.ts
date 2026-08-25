"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { listAuditLogs } from "@/lib/api/audit-logs";
import { listExceptions } from "@/lib/api/exceptions";
import { auditLogKeys } from "@/hooks/use-audit-logs";
import { exceptionKeys } from "@/hooks/use-exceptions";
import { useShipmentList } from "@/hooks/use-shipments";
import { useReceiptList } from "@/hooks/use-receipts";
import { useInvoices } from "@/hooks/use-invoices";
import {
  collectActivityTargets,
  getActivityPollInterval,
  mergeAuditLogs,
} from "@/lib/state/activity-state";
import type { AuditLog, Requisition } from "@/types/models";

/**
 * Whether the workflow downstream of the requisition can still move, for the
 * activity timeline's poll cadence. RequisitionStatus alone stops advancing
 * at "PO_CREATED", so this also looks at the purchase order and the latest
 * (newest-first) invoice — see getActivityPollInterval in lib/state/activity-state.ts.
 */
function hasOpenWork(requisition: Requisition, latestInvoiceStatus: string | undefined): boolean {
  if (requisition.status === "FAILED") return false;
  const po = requisition.purchaseOrder;
  if (!po) return true;
  if (po.status === "REJECTED") return false;
  if (latestInvoiceStatus === "PAID" || latestInvoiceStatus === "FAILED") return false;
  return true;
}

/**
 * Assembles the complete audit-log timeline for one requisition's workflow.
 *
 * GET /audit-logs only filters a single entityType/entityId pair per call
 * (backend-docs/audit-logs-api.md), and the workflow spans six entity types,
 * so this fans out: resolve every related entity id (requisition, PO,
 * shipments, goods receipts, invoices, and — since exception audits are
 * filed under entityType="Exception" rather than the entity they concern —
 * exceptions on the requisition, the PO, and each invoice), then run one
 * audit-logs query per id and merge the results newest-first.
 *
 * The id-resolution queries reuse the same filters/hooks the rest of the
 * detail page already subscribes to (useShipmentList, useReceiptList,
 * useInvoices), so TanStack Query dedupes rather than double-fetching.
 */
export function useRequisitionActivity(requisition: Requisition) {
  const purchaseOrderId = requisition.purchaseOrder?.id;

  const shipments = useShipmentList(
    { purchaseOrderId: purchaseOrderId ?? "", limit: 100 },
    { enabled: Boolean(purchaseOrderId) }
  );
  const receipts = useReceiptList(
    { purchaseOrderId: purchaseOrderId ?? "", limit: 100 },
    { enabled: Boolean(purchaseOrderId) }
  );
  const invoices = useInvoices(
    { purchaseOrderId: purchaseOrderId ?? "", limit: 50 },
    { enabled: Boolean(purchaseOrderId) }
  );

  const shipmentIds = useMemo(
    () => shipments.data?.items.map((s) => s.id) ?? [],
    [shipments.data]
  );
  const goodsReceiptIds = useMemo(
    () => receipts.data?.items.map((r) => r.id) ?? [],
    [receipts.data]
  );
  const invoiceIds = useMemo(() => invoices.data?.items.map((i) => i.id) ?? [], [invoices.data]);

  // Exceptions can be filed against the requisition, the PO, or an invoice —
  // query each so EXCEPTION_CREATED/EXCEPTION_RESOLVED rows aren't missed.
  const exceptionEntityIds = useMemo(
    () => [requisition.id, ...(purchaseOrderId ? [purchaseOrderId] : []), ...invoiceIds],
    [requisition.id, purchaseOrderId, invoiceIds]
  );

  const exceptionQueries = useQueries({
    queries: exceptionEntityIds.map((entityId) => ({
      queryKey: exceptionKeys.list({ entityId, limit: 100 }),
      queryFn: () => listExceptions({ entityId, limit: 100 }),
    })),
  });

  // useQueries returns a fresh array every render (no `combine` passed, so
  // TanStack's replaceEqualDeep never applies) — memoizing directly on
  // `exceptionQueries` would recompute every render and defeat the `targets`
  // memo below it. Fingerprint on each query's last-updated timestamp
  // instead, which is stable between fetches.
  const exceptionSignature = exceptionQueries.map((q) => q.dataUpdatedAt).join(",");
  const exceptionIds = useMemo(
    () => exceptionQueries.flatMap((q) => q.data?.items.map((e) => e.id) ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exceptionSignature stands in for exceptionQueries' contents
    [exceptionSignature]
  );

  const targets = useMemo(
    () =>
      collectActivityTargets({
        requisitionId: requisition.id,
        purchaseOrderId,
        shipmentIds,
        goodsReceiptIds,
        invoiceIds,
        exceptionIds,
      }),
    [requisition.id, purchaseOrderId, shipmentIds, goodsReceiptIds, invoiceIds, exceptionIds]
  );

  const latestInvoiceStatus = invoices.data?.items[0]?.status;
  const pollInterval = getActivityPollInterval(
    requisition.status,
    hasOpenWork(requisition, latestInvoiceStatus)
  );

  // Extra cursors requested per target (beyond each target's first, unpaged
  // page) so "Show more" can pull additional audit-log pages once a target
  // has more than one page's worth (limit: 50) of rows.
  const [extraCursors, setExtraCursors] = useState<Record<string, string[]>>({});

  const targetPageCursors = useMemo(
    () =>
      targets.map((target) => {
        const key = `${target.entityType}:${target.entityId}`;
        return [undefined, ...(extraCursors[key] ?? [])] as (string | undefined)[];
      }),
    [targets, extraCursors]
  );

  // Parallels the flatMap below 1:1, so `auditQueries[i]` and
  // `isFirstPage[i]` always refer to the same query — used to tell a
  // target's live first page (which drives `isLoading`) apart from an
  // older, paged-in page (which drives `isLoadingMore` instead).
  const isFirstPage = targets.flatMap((_, i) => targetPageCursors[i].map((cursor) => cursor === undefined));

  const auditQueries = useQueries({
    queries: targets.flatMap((target, i) =>
      targetPageCursors[i].map((cursor) => {
        const filters = {
          entityType: target.entityType,
          entityId: target.entityId,
          limit: 50,
          cursor,
        };
        return {
          queryKey: auditLogKeys.list(filters),
          queryFn: () => listAuditLogs(filters),
          // Only the first (live) page of each target polls; older pages
          // are immutable history once fetched.
          refetchInterval: cursor === undefined ? pollInterval : false,
        };
      })
    ),
  });

  // Regroup the flat query-result array back per target so nextCursor / more
  // pages can be resolved per entity. Not a useMemo: `auditQueries` is a
  // fresh array from useQueries on every render, so memoizing on it would
  // never actually hit — this recomputes every render, same as the memo did.
  const pageCounts = targetPageCursors.map((cursors) => cursors.length);
  const groupStarts = pageCounts.reduce<number[]>((starts, count, i) => {
    starts.push(i === 0 ? 0 : starts[i - 1] + pageCounts[i - 1]);
    return starts;
  }, []);
  const targetQueryGroups = targets.map((target, i) => ({
    target,
    group: auditQueries.slice(groupStarts[i], groupStarts[i] + pageCounts[i]),
  }));

  const hasMoreAudit = targetQueryGroups.some(({ group }) => {
    const last = group[group.length - 1];
    return Boolean(last?.data?.nextCursor);
  });

  const loadMoreAudit = () => {
    setExtraCursors((prev) => {
      const next = { ...prev };
      for (const { target, group } of targetQueryGroups) {
        const last = group[group.length - 1];
        const nextCursor = last?.data?.nextCursor;
        if (nextCursor) {
          const key = `${target.entityType}:${target.entityId}`;
          next[key] = [...(prev[key] ?? []), nextCursor];
        }
      }
      return next;
    });
  };

  // mergeAuditLogs does a Map insert + localeCompare sort over every row
  // across every target's every page — worth memoizing given this hook
  // recomputes on every ~1s poll tick. Same "fresh array every render"
  // caveat as exceptionIds above: fingerprint on dataUpdatedAt instead of
  // depping on `auditQueries` directly.
  const auditSignature = auditQueries.map((q) => q.dataUpdatedAt).join(",");
  const rows: AuditLog[] = useMemo(
    () => mergeAuditLogs(auditQueries.map((q) => q.data?.items ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auditSignature stands in for auditQueries' contents
    [auditSignature]
  );

  // Resolving the fan-out targets (shipments/receipts/invoices/exceptions)
  // and the audit rows themselves are both "loading" from the caller's
  // perspective — the timeline has nothing to show until both settle. Only
  // each target's first (live) page counts: paging in an older page via
  // "Show more" must not flip the whole timeline back to a loading state.
  const resolvingTargets =
    (Boolean(purchaseOrderId) && (shipments.isLoading || receipts.isLoading || invoices.isLoading)) ||
    exceptionQueries.some((q) => q.isLoading);
  const isLoading =
    resolvingTargets ||
    (targets.length > 0 && auditQueries.some((q, i) => isFirstPage[i] && q.isLoading));

  // True only for the span between a "Show more" click and the resulting
  // fetch landing. `isPending` (no cached data yet) rather than `isFetching`
  // (also true for ambient background refetches) — and, crucially, false
  // immediately for a page already in the cache, so this can't latch true
  // forever the way a `prevIsFetching` render-phase comparison could when a
  // fetch never observably transitions.
  const isLoadingMore = auditQueries.some((q, i) => !isFirstPage[i] && q.isPending);

  // Target resolution (shipments/receipts/invoices/exceptions) failing means
  // the fan-out itself is incomplete or wrong — that's worth surfacing even
  // though targets.length is never actually 0 (it always includes the
  // requisition), since a dead resolution query silently drops ids from the
  // audit-log fan-out otherwise. Degrade rather than blank out for the audit
  // queries themselves: only report an audit error when every audit query
  // failed, since one dead sub-query shouldn't hide the rest.
  const resolutionQueries = [shipments, receipts, invoices, ...exceptionQueries];
  const failedResolutionQueries = resolutionQueries.filter((q) => q.isError);
  const failedAuditQueries = auditQueries.filter((q) => q.isError);
  const isError =
    failedResolutionQueries.length > 0 ||
    (targets.length > 0 && auditQueries.length > 0 && failedAuditQueries.length === auditQueries.length);
  const error = isError ? (failedResolutionQueries[0]?.error ?? failedAuditQueries[0]?.error) : null;

  const refetch = () => {
    shipments.refetch();
    receipts.refetch();
    invoices.refetch();
    exceptionQueries.forEach((q) => q.refetch());
    auditQueries.forEach((q) => q.refetch());
  };

  return { rows, isLoading, isLoadingMore, isError, error, refetch, hasMoreAudit, loadMoreAudit };
}
