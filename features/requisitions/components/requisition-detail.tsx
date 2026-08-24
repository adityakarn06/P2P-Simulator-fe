"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { WorkflowSection } from "@/components/workflow-section";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { formatDate } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, InformationCircleIcon } from "@/lib/icons";
import { useRequisition, useSendRequisitionMessage } from "@/hooks/use-requisitions";
import { RequisitionTranscript } from "@/features/requisitions/components/requisition-transcript";
import { ClarificationPanel } from "@/features/requisitions/components/clarification-panel";
import { RequirementsCard } from "@/features/requisitions/components/requirements-card";
import { RequisitionComposer } from "@/features/requisitions/components/requisition-composer";
import { SourcingSection } from "@/features/sourcing/components/sourcing-section";
import { PurchaseOrderSection } from "@/features/purchase-orders/components/purchase-order-section";
import {
  deriveWorkflowStages,
  getPollInterval,
  isComposerEnabled,
  shouldShowSlowNotice,
} from "@/features/requisitions/lib/requisition-state";

interface RequisitionDetailProps {
  id: string;
}

export function RequisitionDetail({ id }: RequisitionDetailProps) {
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  // Tracks how long the current status has been polling, for the "still
  // processing" notice. Reset in an effect whenever status changes;
  // recomputed in an effect on every poll tick (dataUpdatedAt changes each
  // fetch) rather than during render, which must stay pure.
  const [showSlowNotice, setShowSlowNotice] = useState(false);
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

  useEffect(() => {
    if (!requisition) return;
    const statusChanged = requisition.status !== lastStatusRef.current;
    if (statusChanged) {
      lastStatusRef.current = requisition.status;
      pollStartedAtRef.current = Date.now();
    }
    const pollStartedAt = pollStartedAtRef.current;
    setShowSlowNotice(
      pollStartedAt != null
        ? shouldShowSlowNotice(pollStartedAt, Date.now(), requisition.status)
        : false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataUpdatedAt is the poll-tick signal
  }, [requisition?.status, dataUpdatedAt]);

  if (isLoading) {
    return <LoadingState message="Loading requisition…" className="flex-1" />;
  }

  if (isError || !requisition) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const composerEnabled = isComposerEnabled(requisition);
  const stages = deriveWorkflowStages(requisition);
  const conversationOpen = requisition.requirement == null;
  const showSourcing =
    requisition.sourcing != null ||
    requisition.supplierCandidates.length > 0 ||
    requisition.status === "REQUIREMENTS_EXTRACTED" ||
    (requisition.status === "FAILED" && requisition.requirement != null);

  const handleSend = (input: string) => {
    setPendingUserText(input);
    sendMessage.mutate(
      { id, input },
      {
        onSettled: () => setPendingUserText(null),
      }
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Requisition"
        description={requisition.rawInput}
        actions={<StatusBadge status={requisition.status} />}
      />

      <WorkflowTimeline stages={stages} className="rounded-lg border p-4" />

      {showSlowNotice && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <HugeiconsIcon icon={InformationCircleIcon} className="mt-0.5 size-4 shrink-0" />
          <p>Still processing. We&apos;ll update this page when it&apos;s ready.</p>
        </div>
      )}

      {requisition.status === "FAILED" && requisition.failureReason && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0" />
          <p>{requisition.failureReason}</p>
        </div>
      )}

      <WorkflowSection title="Request">
        <div className="space-y-1">
          <p className="text-sm">{requisition.rawInput}</p>
          <p className="text-xs text-muted-foreground">
            Submitted {formatDate(requisition.createdAt)}
          </p>
        </div>
      </WorkflowSection>

      <WorkflowSection title="Conversation" defaultOpen={conversationOpen}>
        <div className="flex flex-col gap-3">
          <RequisitionTranscript
            messages={requisition.messages}
            pendingUserText={pendingUserText}
            isWaitingForReply={sendMessage.isPending}
            className="max-h-96 overflow-y-auto"
          />

          {composerEnabled && (
            <ClarificationPanel
              missingFields={requisition.missingFields}
              conflicts={requisition.conflicts}
            />
          )}

          {composerEnabled ? (
            <RequisitionComposer
              placeholder="Reply to the assistant…"
              onSend={handleSend}
              isPending={sendMessage.isPending}
              error={sendMessage.error}
              onRetry={() => sendMessage.reset()}
            />
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {requisition.requirement != null
                ? "Requirements are complete — chat is closed."
                : "Chat is closed while the assistant works."}
            </p>
          )}
        </div>
      </WorkflowSection>

      {requisition.requirement && (
        <RequirementsCard
          requirement={requisition.requirement}
          sinceIso={requisition.messages.at(-1)?.createdAt ?? requisition.createdAt}
        />
      )}

      {showSourcing && (
        <WorkflowSection title="Supplier Discovery">
          <SourcingSection requisition={requisition} />
        </WorkflowSection>
      )}

      {requisition.purchaseOrder && (
        <WorkflowSection title="Purchase Order">
          <PurchaseOrderSection
            requisitionId={requisition.id}
            purchaseOrder={requisition.purchaseOrder}
          />
        </WorkflowSection>
      )}
    </div>
  );
}
