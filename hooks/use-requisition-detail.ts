"use client";

import { useEffect, useRef } from "react";
import { useRequisition, useSendRequisitionMessage } from "@/hooks/use-requisitions";
import { useInvoices } from "@/hooks/use-invoices";
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
  // Same filters shape as InvoiceSection's useInvoices() call, so TanStack
  // Query dedupes both subscriptions onto a single ["invoices","list",…] key.
  // Polls while the latest (first, newest-first) invoice is still moving
  // through a worker stage, so the timeline's Invoice stage doesn't go stale
  // between whatever else happens to invalidate this list.
  const invoices = useInvoices(
    { purchaseOrderId: purchaseOrder?.id ?? "", limit: 50 },
    {
      enabled: invoiceSectionShown,
      refetchInterval: (query) => {
        const status = query.state.data?.items[0]?.status;
        return status ? getInvoicePollInterval(status) : false;
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
  const latestInvoiceStatus = invoiceSectionShown
    ? invoices.data
      ? (invoices.data.items[0]?.status ?? null)
      : undefined
    : null;
  const stages = requisition ? deriveWorkflowStages(requisition, latestInvoiceStatus) : [];
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
    conversationOpen,
    showSourcing,
  };
}
