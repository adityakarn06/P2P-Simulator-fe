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
import { formatDate } from "@/lib/formatters";
import { usePurchaseOrderActions } from "@/hooks/use-purchase-order-actions";
import { RejectPoDialog } from "@/components/purchase-orders/reject-po-dialog";
import type { PurchaseOrder } from "@/types/models";

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
    rejectDialogOpen,
    openRejectDialog,
    onRejectDialogChange,
    rejectReason,
    setRejectReason,
    rejectReasonError,
    handleConfirmReject,
  } = usePurchaseOrderActions(requisitionId, purchaseOrder.id);

  const canAction = purchaseOrder.status === "PENDING_APPROVAL";
  const taxPercent = purchaseOrder.taxRateBps / 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{purchaseOrder.poNumber}</p>
          <p className="text-xs text-muted-foreground">{purchaseOrder.supplier.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={purchaseOrder.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Expected delivery</p>
          <p className="text-sm">{formatDate(purchaseOrder.expectedDeliveryDate)}</p>
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

      {purchaseOrder.rejectionReason && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {purchaseOrder.rejectionReason}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Line Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrder.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-foreground">{item.description}</TableCell>
              <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
              <TableCell className="text-right">
                <Money paise={item.unitPricePaise} />
              </TableCell>
              <TableCell className="text-right">
                <Money paise={item.lineTotalPaise} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="ml-auto w-full max-w-[220px] space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <Money paise={purchaseOrder.subtotalPaise} />
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax ({taxPercent}%)</span>
          <Money paise={purchaseOrder.taxPaise} />
        </div>
        <div className="flex justify-between border-t pt-1 font-medium">
          <span>Total</span>
          <Money paise={purchaseOrder.totalPaise} />
        </div>
      </div>

      {canAction && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={approve.isPending || reject.isPending}
              onClick={() => approve.mutate({ id: purchaseOrder.id, requisitionId })}
              className="gap-1.5"
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={approve.isPending || reject.isPending}
              onClick={openRejectDialog}
            >
              Reject
            </Button>
          </div>
          {approve.error != null && <InlineError error={approve.error} />}
        </div>
      )}

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
