"use client";

import { useEffect, useRef } from "react";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Separator } from "@/components/ui/separator";
import { Callout } from "@/components/common/callout";
import { WorkflowTimeline } from "@/components/workflow/workflow-timeline";
import { WorkflowProgressGauge } from "@/components/workflow/workflow-progress-gauge";
import { WorkflowSection } from "@/components/workflow/workflow-section";
import { ProcessingIndicator } from "@/components/workflow/processing-indicator";
import { ErrorState } from "@/components/common/error-state";
import { RequisitionDetailSkeleton } from "@/components/requisitions/requisition-detail-skeleton";
import { formatDate } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, InformationCircleIcon } from "@/lib/icons";
import { useRequisitionDetail } from "@/hooks/use-requisition-detail";
import { RequisitionTranscript } from "@/components/requisitions/requisition-transcript";
import { ClarificationPanel } from "@/components/requisitions/clarification-panel";
import { RequirementsCard } from "@/components/requisitions/requirements-card";
import { RequisitionComposer } from "@/components/requisitions/requisition-composer";
import { SourcingSection } from "@/components/sourcing/sourcing-section";
import { PurchaseOrderSection } from "@/components/purchase-orders/purchase-order-section";
import { ShipmentSection } from "@/components/shipments/shipment-section";
import { shouldShowShipmentSection } from "@/lib/state/shipment-state";
import { InvoiceSection } from "@/components/invoices/invoice-section";
import { shouldShowInvoiceSection } from "@/lib/state/invoice-state";
import { RequisitionActivity } from "@/components/requisitions/requisition-activity";
import { RequisitionExceptionAlert } from "@/components/exceptions/requisition-exception-alert";
import type { WorkflowStage } from "@/components/workflow/workflow-step";

interface RequisitionDetailProps {
  id: string;
}

/** A section header's badge: the stage's own activity caption, when it has one. */
function sectionActivity(stages: WorkflowStage[], stageId: string) {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage?.activity) return null;
  return <ProcessingIndicator label={stage.activity.label} variant={stage.activity.variant} />;
}

/**
 * Timeline stage ids don't map 1:1 to WorkflowSection ids — several stages
 * (goods-receipt, matching, payment) share a section with a neighbor, and
 * some sections only render once their data exists. List candidates in
 * priority order; the first one actually present in the DOM wins.
 */
const STAGE_TO_SECTION_CANDIDATES: Record<string, string[]> = {
  request: ["request"],
  requirements: ["requirements", "conversation"],
  sourcing: ["sourcing", "conversation"],
  "purchase-order": ["purchase-order"],
  shipment: ["shipment"],
  "goods-receipt": ["shipment"],
  invoice: ["invoice"],
  matching: ["invoice"],
  payment: ["invoice"],
};

function scrollToStageSection(requisitionId: string, stage: WorkflowStage) {
  const candidates = STAGE_TO_SECTION_CANDIDATES[stage.id] ?? [];
  for (const suffix of candidates) {
    const el = document.getElementById(`${requisitionId}:${suffix}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
}

export function RequisitionDetail({ id }: RequisitionDetailProps) {
  const {
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
  } = useRequisitionDetail(id);

  // Auto-scroll to whichever section is currently active as the workflow
  // progresses (polling advances it in real time), so the user watching the
  // timeline doesn't have to manually track down where things moved.
  const activeStage = stages?.find((s) => s.status === "active") ?? null;
  const lastAutoScrolledStageIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!requisition || !activeStage) return;
    if (lastAutoScrolledStageIdRef.current === activeStage.id) return;
    lastAutoScrolledStageIdRef.current = activeStage.id;
    scrollToStageSection(requisition.id, activeStage);
  }, [requisition, activeStage]);

  if (isLoading) {
    return <RequisitionDetailSkeleton />;
  }

  if (isError || !requisition) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Requisition"
        description={requisition.rawInput}
        descriptionClassName="line-clamp-2"
        actions={
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={requisition.status} />
            {headerActivity && (
              <ProcessingIndicator
                label={headerActivity.label}
                variant={headerActivity.variant}
                announce
              />
            )}
          </div>
        }
      />

      <Separator />

      {exceptionInvoiceId && <RequisitionExceptionAlert invoiceId={exceptionInvoiceId} />}

      {showSlowNotice && (
        <Callout
          tone="info"
          icon={<HugeiconsIcon icon={InformationCircleIcon} className="size-4" />}
        >
          <p>Still processing. We&apos;ll update this page when it&apos;s ready.</p>
        </Callout>
      )}

      {requisition.status === "FAILED" && requisition.failureReason && (
        <Callout tone="error" icon={<HugeiconsIcon icon={Alert01Icon} className="size-4" />}>
          <p>{requisition.failureReason}</p>
        </Callout>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <WorkflowSection sectionId={`${requisition.id}:request`} title="Request">
            <div className="space-y-1">
              <p className="text-sm">{requisition.rawInput}</p>
              <p className="text-xs text-muted-foreground">
                Submitted {formatDate(requisition.createdAt)}
              </p>
            </div>
          </WorkflowSection>

          <WorkflowSection
            sectionId={`${requisition.id}:conversation`}
            title="Conversation"
            status={sectionActivity(stages, "requirements")}
            defaultOpen={conversationOpen}
          >
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
                  storeKey={requisition.id}
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
            <WorkflowSection sectionId={`${requisition.id}:requirements`} title="Requirements">
              <RequirementsCard
                requirement={requisition.requirement}
                sinceIso={requisition.messages.at(-1)?.createdAt ?? requisition.createdAt}
              />
            </WorkflowSection>
          )}

          {showSourcing && (
            <WorkflowSection
              sectionId={`${requisition.id}:sourcing`}
              title="Supplier Discovery"
              status={sectionActivity(stages, "sourcing")}
            >
              <SourcingSection requisition={requisition} />
            </WorkflowSection>
          )}

          {requisition.purchaseOrder && (
            <WorkflowSection
              sectionId={`${requisition.id}:purchase-order`}
              title="Purchase Order"
              status={
                <div className="flex items-center gap-2">
                  <StatusBadge status={requisition.purchaseOrder.status} />
                  {sectionActivity(stages, "purchase-order")}
                </div>
              }
            >
              <PurchaseOrderSection
                requisitionId={requisition.id}
                purchaseOrder={requisition.purchaseOrder}
              />
            </WorkflowSection>
          )}

          {requisition.purchaseOrder && shouldShowShipmentSection(requisition.purchaseOrder) && (
            <WorkflowSection
              sectionId={`${requisition.id}:shipment`}
              title="Shipment & Goods Receipt"
              status={sectionActivity(stages, "shipment")}
            >
              <ShipmentSection
                requisitionId={requisition.id}
                purchaseOrder={requisition.purchaseOrder}
              />
            </WorkflowSection>
          )}

          {requisition.purchaseOrder && shouldShowInvoiceSection(requisition.purchaseOrder) && (
            <WorkflowSection
              sectionId={`${requisition.id}:invoice`}
              title="Invoice"
              status={
                sectionActivity(stages, "invoice") ??
                sectionActivity(stages, "matching") ??
                sectionActivity(stages, "payment")
              }
            >
              <InvoiceSection
                requisitionId={requisition.id}
                purchaseOrder={requisition.purchaseOrder}
              />
            </WorkflowSection>
          )}

          <WorkflowSection
            sectionId={`${requisition.id}:activity`}
            title="Activity"
            defaultOpen={false}
          >
            <RequisitionActivity requisition={requisition} />
          </WorkflowSection>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:sticky lg:top-4 lg:mt-0">
          <WorkflowTimeline
            stages={stages}
            className="rounded-lg border p-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
            onStageSelect={(stage) => scrollToStageSection(requisition.id, stage)}
          />
          <WorkflowProgressGauge stages={stages} />
        </div>
      </div>
    </div>
  );
}
