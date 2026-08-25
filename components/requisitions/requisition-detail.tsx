"use client";

import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkflowTimeline } from "@/components/workflow/workflow-timeline";
import { WorkflowSection } from "@/components/workflow/workflow-section";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
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

interface RequisitionDetailProps {
  id: string;
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
    conversationOpen,
    showSourcing,
  } = useRequisitionDetail(id);

  if (isLoading) {
    return <LoadingState message="Loading requisition…" className="flex-1" />;
  }

  if (isError || !requisition) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

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
        <RequirementsCard
          requirement={requisition.requirement}
          sinceIso={requisition.messages.at(-1)?.createdAt ?? requisition.createdAt}
        />
      )}

      {showSourcing && (
        <WorkflowSection sectionId={`${requisition.id}:sourcing`} title="Supplier Discovery">
          <SourcingSection requisition={requisition} />
        </WorkflowSection>
      )}

      {requisition.purchaseOrder && (
        <WorkflowSection sectionId={`${requisition.id}:purchase-order`} title="Purchase Order">
          <PurchaseOrderSection
            requisitionId={requisition.id}
            purchaseOrder={requisition.purchaseOrder}
          />
        </WorkflowSection>
      )}

      {requisition.purchaseOrder && shouldShowShipmentSection(requisition.purchaseOrder) && (
        <WorkflowSection sectionId={`${requisition.id}:shipment`} title="Shipment & Goods Receipt">
          <ShipmentSection
            requisitionId={requisition.id}
            purchaseOrder={requisition.purchaseOrder}
          />
        </WorkflowSection>
      )}

      {requisition.purchaseOrder && shouldShowInvoiceSection(requisition.purchaseOrder) && (
        <WorkflowSection sectionId={`${requisition.id}:invoice`} title="Invoice">
          <InvoiceSection
            requisitionId={requisition.id}
            purchaseOrder={requisition.purchaseOrder}
          />
        </WorkflowSection>
      )}
    </div>
  );
}
