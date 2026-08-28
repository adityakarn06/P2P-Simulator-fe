import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { Money } from "@/components/common/money";
import { InlineError } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import { Callout } from "@/components/common/callout";
import { formatDate } from "@/lib/formatters";
import { isAwaitingApproval, isRejected, formatTaxRate, PO_APPROVAL_PROMPT } from "@/lib/state/purchase-order-state";
import { usePurchaseOrderActions } from "@/hooks/use-purchase-order-actions";
import { RejectPoDialog } from "@/components/purchase-orders/reject-po-dialog";
import { DocumentActions } from "@/components/documents/document-actions";
import { getPurchaseOrderPdf } from "@/lib/api/documents";
import type { PurchaseOrder } from "@/types/models";
import { EntityAnomalies } from "@/components/analytics/entity-anomalies";

interface PurchaseOrderSectionProps {
  requisitionId: string;
  purchaseOrder: PurchaseOrder;
}

/**
 * Renders the embedded `requisition.purchaseOrder` — no second fetch needed
 * (backend-docs/purchase-orders-api.md: "no second request is needed to
 * decide whether approval is required"). Approve/reject only render while
 * `status === "PENDING_APPROVAL"`.
 */
export function PurchaseOrderSection({
  requisitionId,
  purchaseOrder,
}: PurchaseOrderSectionProps) {
  const {
    approve,
    reject,
    actionsDisabled,
    rejectDialogOpen,
    openRejectDialog,
    onRejectDialogChange,
    rejectReason,
    setRejectReason,
    rejectReasonError,
    handleApprove,
    handleConfirmReject,
  } = usePurchaseOrderActions(requisitionId, purchaseOrder);

  const awaitingApproval = isAwaitingApproval(purchaseOrder);

  return (
    <div className="space-y-4">
      {/* Statistical outliers on this order — price, quantity, a first-ever
          high-value supplier, a predicted late delivery. Advisory context for
          the approver; never a gate. */}
      <EntityAnomalies entityType="PurchaseOrder" entityId={purchaseOrder.id} />

      {awaitingApproval && (
        <Callout tone="progress">
          <p className="font-medium text-foreground">{PO_APPROVAL_PROMPT}</p>
          <p className="text-xs text-muted-foreground">
            {purchaseOrder.poNumber} · {purchaseOrder.supplier.name} ·{" "}
            <Money paise={purchaseOrder.totalPaise} />
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button disabled={actionsDisabled} onClick={handleApprove} className="gap-1.5">
              {approve.isPending && <Spinner size="sm" />}
              Approve PO
            </Button>
            <Button
              variant="outline"
              disabled={actionsDisabled}
              onClick={openRejectDialog}
            >
              Reject PO
            </Button>
          </div>
          {approve.error != null && <InlineError error={approve.error} />}
        </Callout>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{purchaseOrder.poNumber}</p>
          <p className="text-xs text-muted-foreground">{purchaseOrder.supplier.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={purchaseOrder.status} />
          <DocumentActions
            fetcher={() => getPurchaseOrderPdf(purchaseOrder.id)}
            fallbackFilename={`purchase-order-${purchaseOrder.poNumber}.pdf`}
            title={`Purchase Order ${purchaseOrder.poNumber}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Expected delivery</p>
          <p className="text-sm">{formatDate(purchaseOrder.expectedDeliveryDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Currency</p>
          <p className="text-sm">{purchaseOrder.currency}</p>
        </div>
        {purchaseOrder.approvedAt && (
          <div>
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-sm">
              {formatDate(purchaseOrder.approvedAt)}
              {purchaseOrder.approvedBy ? ` · ${purchaseOrder.approvedBy}` : ""}
            </p>
          </div>
        )}
        {purchaseOrder.rejectedAt && (
          <div>
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-sm">{formatDate(purchaseOrder.rejectedAt)}</p>
          </div>
        )}
      </div>

      {isRejected(purchaseOrder) && purchaseOrder.rejectionReason && (
        <Callout tone="error">
          <p className="text-xs font-medium">Rejection reason</p>
          <p>{purchaseOrder.rejectionReason}</p>
        </Callout>
      )}

      <div className="rounded-md border">
        <Table>
          <caption className="sr-only">Purchase order line items</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Description</TableHead>
              <TableHead scope="col" className="text-right">
                Qty
              </TableHead>
              <TableHead scope="col" className="text-right">
                Unit Price
              </TableHead>
              <TableHead scope="col" className="text-right">
                Line Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrder.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No line items.
                </TableCell>
              </TableRow>
            ) : (
              purchaseOrder.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    <Money paise={item.unitPricePaise} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money paise={item.lineTotalPaise} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="ml-auto w-full max-w-[220px] space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <Money paise={purchaseOrder.subtotalPaise} />
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>GST ({formatTaxRate(purchaseOrder.taxRateBps)})</span>
          <Money paise={purchaseOrder.taxPaise} />
        </div>
        <div className="flex justify-between border-t pt-1 font-medium">
          <span>Total</span>
          <Money paise={purchaseOrder.totalPaise} />
        </div>
        <p className="text-right text-xs text-muted-foreground">
          Amounts in {purchaseOrder.currency}
        </p>
      </div>

      <RejectPoDialog
        open={rejectDialogOpen}
        onOpenChange={onRejectDialogChange}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        validationError={rejectReasonError}
        isPending={reject.isPending}
        error={reject.error}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
}
