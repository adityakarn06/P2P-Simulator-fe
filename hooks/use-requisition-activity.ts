"use client";

import { useMemo } from "react";
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

  const exceptionIds = useMemo(
    () =>
      exceptionQueries.flatMap((q) => q.data?.items.map((e) => e.id) ?? []),
    [exceptionQueries]
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

  const auditQueries = useQueries({
    queries: targets.map((target) => {
      const filters = { entityType: target.entityType, entityId: target.entityId, limit: 50 };
      return {
        queryKey: auditLogKeys.list(filters),
        queryFn: () => listAuditLogs(filters),
        refetchInterval: pollInterval,
      };
    }),
  });

  const rows: AuditLog[] = useMemo(
    () => mergeAuditLogs(auditQueries.map((q) => q.data?.items ?? [])),
    [auditQueries]
  );

  // Resolving the fan-out targets (shipments/receipts/invoices/exceptions)
  // and the audit rows themselves are both "loading" from the caller's
  // perspective — the timeline has nothing to show until both settle.
  const resolvingTargets =
    (Boolean(purchaseOrderId) && (shipments.isLoading || receipts.isLoading || invoices.isLoading)) ||
    exceptionQueries.some((q) => q.isLoading);
  const isLoading = resolvingTargets || (targets.length > 0 && auditQueries.some((q) => q.isLoading));

  const isFetching = auditQueries.some((q) => q.isFetching);

  // Degrade rather than blank out: only report an error when every audit
  // query failed, since one dead sub-query shouldn't hide the rest.
  const failedAuditQueries = auditQueries.filter((q) => q.isError);
  const isError = targets.length > 0 && failedAuditQueries.length === auditQueries.length;
  const error = isError ? failedAuditQueries[0]?.error : null;

  const refetch = () => {
    auditQueries.forEach((q) => q.refetch());
  };

  return { rows, isLoading, isFetching, isError, error, refetch };
}
