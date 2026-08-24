"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { WorkflowTimeline } from "@/components/workflow-timeline";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon } from "@/lib/icons";
import { useRequisition, useSendRequisitionMessage } from "@/hooks/use-requisitions";
import { RequisitionTranscript } from "@/features/requisitions/components/requisition-transcript";
import { ClarificationPanel } from "@/features/requisitions/components/clarification-panel";
import { RequirementsCard } from "@/features/requisitions/components/requirements-card";
import { RequisitionComposer } from "@/features/requisitions/components/requisition-composer";
import {
  deriveWorkflowStages,
  getPollInterval,
  isComposerEnabled,
} from "@/features/requisitions/lib/requisition-state";

interface RequisitionDetailProps {
  id: string;
}

export function RequisitionDetail({ id }: RequisitionDetailProps) {
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);

  const {
    data: requisition,
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

  if (isLoading) {
    return <LoadingState message="Loading requisition…" className="flex-1" />;
  }

  if (isError || !requisition) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const composerEnabled = isComposerEnabled(requisition);
  const stages = deriveWorkflowStages(requisition);

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

      <WorkflowTimeline stages={stages} />

      {requisition.status === "FAILED" && requisition.failureReason && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0" />
          <p>{requisition.failureReason}</p>
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <RequisitionTranscript
            messages={requisition.messages}
            pendingUserText={pendingUserText}
            isWaitingForReply={sendMessage.isPending}
            className="flex-1 overflow-y-auto"
          />

          <ClarificationPanel
            missingFields={requisition.missingFields}
            conflicts={requisition.conflicts}
          />

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

        {requisition.requirement && (
          <RequirementsCard
            requirement={requisition.requirement}
            sinceIso={requisition.createdAt}
          />
        )}
      </div>
    </div>
  );
}
