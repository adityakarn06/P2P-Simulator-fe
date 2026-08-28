"use client";

import { useEffect, useRef } from "react";
import { useRequisition, useSendRequisitionMessage } from "@/hooks/use-requisitions";
import { useInvoices } from "@/hooks/use-invoices";
import { usePurchaseOrder } from "@/hooks/use-purchase-orders";
import { useShipment } from "@/hooks/use-shipments";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { useRequisitionStore } from "@/store/requisition-store";
import {
  deriveWorkflowStages,
  getPollInterval,
  isComposerEnabled,
  shouldShowSlowNotice,
} from "@/lib/state/requisition-state";
import { shouldShowInvoiceSection, getInvoicePollInterval } from "@/lib/state/invoice-state";

/**
 * Owns everything the /requisitions/[id] screen needs: the polling detail
 * query, the send-message mutation, the optimistic pending-text + slow-notice
 * UI state (in the requisition store, keyed by id), and the derived
 * workflow flags. The component stays presentational.
 */
export function useRequisitionDetail(id: string) {
  const pendingUserText = useRequisitionStore((s) => s.pendingUserText[id] ?? null);
  const setPendingUserText = useRequisitionStore((s) => s.setPendingUserText);
  const clearPendingUserText = useRequisitionStore((s) => s.clearPendingUserText);
  const showSlowNotice = useRequisitionStore((s) => s.slowNoticeVisible[id] ?? false);
  const setSlowNoticeVisible = useRequisitionStore((s) => s.setSlowNoticeVisible);

  // Tracks how long the current status has been polling, for the "still
  // processing" notice. Reset whenever status changes; recomputed on every
  // poll tick (dataUpdatedAt changes each fetch) rather than during render,
  // which must stay pure.
  const pollStartedAtRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  const {
    data: requisition,
    dataUpdatedAt,
    isLoading,
    isError,
    error,
    refetch,
  } = useRequisition(id, {
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status ? getPollInterval(status) : false;
    },
    staleTime: 0,
  });

  const sendMessage = useSendRequisitionMessage();

  const purchaseOrder = requisition?.purchaseOrder ?? null;
  const invoiceSectionShown = purchaseOrder != null && shouldShowInvoiceSection(purchaseOrder);

  // Same query key as useShipmentSection's usePurchaseOrder(purchaseOrder.id)
  // call (hooks/use-shipment-section.ts), so this dedupes onto the ShipmentSection's
  // subscription rather than double-fetching — used only to source the real
  // shipment/goods-receipt timestamps the timeline shows per stage.
  const poDetail = usePurchaseOrder(purchaseOrder?.id ?? "", {
    enabled: purchaseOrder != null,
  });
  const shipmentId = poDetail.data?.shipment?.id ?? "";
  const shipment = useShipment(shipmentId, { enabled: Boolean(shipmentId) });
  // Same filters shape as InvoiceSection's real-invoice useInvoices() call —
  // source: "UPLOADED" excludes the GENERATED demo document, which never
  // enters matching and must not drive the timeline — so TanStack Query
  // dedupes both subscriptions onto a single ["invoices","list",…] key.
  // Polls while the latest (first, newest-first) invoice is still moving
  // through a worker stage, so the timeline's Invoice stage doesn't go stale
  // between whatever else happens to invalidate this list.
  const invoices = useInvoices(
    { purchaseOrderId: purchaseOrder?.id ?? "", source: "UPLOADED", limit: 50 },
    {
      enabled: invoiceSectionShown,
      refetchInterval: (query) => {
        const invoice = query.state.data?.items[0];
        return invoice ? getInvoicePollInterval(invoice.status, invoice.source) : false;
      },
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (!requisition) return;
    const statusChanged = requisition.status !== lastStatusRef.current;
    if (statusChanged) {
      lastStatusRef.current = requisition.status;
      pollStartedAtRef.current = Date.now();
    }
    const pollStartedAt = pollStartedAtRef.current;
    setSlowNoticeVisible(
      id,
      pollStartedAt != null
        ? shouldShowSlowNotice(pollStartedAt, Date.now(), requisition.status)
        : false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataUpdatedAt is the poll-tick signal
  }, [requisition?.status, dataUpdatedAt, id]);

  useEffect(() => {
    return () => {
      clearPendingUserText(id);
    };
  }, [id, clearPendingUserText]);

  const handleSend = (input: string) => {
    setPendingUserText(id, input);
    sendMessage.mutate(
      { id, input },
      {
        onSettled: () => clearPendingUserText(id),
      }
    );
  };

  const composerEnabled = requisition ? isComposerEnabled(requisition) : false;
  // Invoices list newest first (backend-docs/invoices-api.md) — the first
  // item is the latest invoice's status for the timeline's Invoice/Matching/
  // Payment stages. `undefined` (query hasn't resolved yet) is kept distinct
  // from `null` (resolved, confirmed empty) so the Invoice stage doesn't
  // flash "active — upload the invoice" for a PO that already has one, in
  // the moment before this list's first fetch completes.
  const latestInvoice = invoiceSectionShown ? invoices.data?.items[0] : undefined;
  const latestInvoiceStatus = invoiceSectionShown
    ? invoices.data
      ? (latestInvoice?.status ?? null)
      : undefined
    : null;
  // Only meaningful once latestInvoiceStatus === "EXCEPTION" — see
  // RequisitionExceptionAlert, the one consumer.
  const exceptionInvoiceId =
    latestInvoiceStatus === "EXCEPTION" ? (latestInvoice?.id ?? null) : null;

  // Invoice.status has no matchedAt/paidAt field, so the Matching and Payment
  // stages' timestamps come from the one place the backend actually records
  // when each finished: the audit trail (backend-docs/audit-logs-api.md).
  // Scoped to this invoice + a single action so each query returns at most
  // the one row that matters, newest first.
  const invoiceId = latestInvoice?.id ?? "";
  const matchCompletedLog = useAuditLogs(
    { entityType: "Invoice", entityId: invoiceId, action: "MATCH_COMPLETED", limit: 1 },
    { enabled: Boolean(invoiceId) }
  );
  const paymentCompletedLog = useAuditLogs(
    { entityType: "Invoice", entityId: invoiceId, action: "PAYMENT_COMPLETED", limit: 1 },
    { enabled: Boolean(invoiceId) }
  );

  const stages = requisition
    ? deriveWorkflowStages(requisition, latestInvoiceStatus, {
        latestInvoice,
        shipment: poDetail.data?.shipment,
        goodsReceipt: shipment.data?.goodsReceipt,
        matchCompletedAt: matchCompletedLog.data?.items[0]?.createdAt ?? null,
        paymentCompletedAt: paymentCompletedLog.data?.items[0]?.createdAt ?? null,
      })
    : [];
  // The page header's pill: read back off the already-derived stages (rather
  // than recomputing with getWorkerActivity/getAwaitingAction) so the header
  // and the timeline can never disagree about which stage is active or what
  // its caption says. A "working" caption takes priority if — contrary to
  // the invariant the two derivation functions maintain — more than one
  // stage somehow carries an activity at once.
  const headerActivity =
    stages.find((s) => s.activity?.variant === "working")?.activity ??
    stages.find((s) => s.activity?.variant === "awaiting")?.activity ??
    null;
  const conversationOpen = requisition ? requisition.requirement == null : false;
  const showSourcing = requisition
    ? requisition.sourcing != null ||
      requisition.supplierCandidates.length > 0 ||
      requisition.status === "REQUIREMENTS_EXTRACTED" ||
      (requisition.status === "FAILED" && requisition.requirement != null)
    : false;

  return {
    requisition,
    isLoading,
    isError,
    error,
    refetch,
    pendingUserText,
    showSlowNotice,
    sendMessage,
    handleSend,
    composerEnabled,
    stages,
    headerActivity,
    exceptionInvoiceId,
    conversationOpen,
    showSourcing,
  };
}
