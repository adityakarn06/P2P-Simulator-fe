import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { DocumentActions } from "@/components/documents/document-actions";
import { getReceiptPdf } from "@/lib/api/documents";
import { formatDateTime } from "@/lib/formatters";
import { deriveReceiptRows } from "@/lib/state/shipment-state";
import type { GoodsReceipt, PurchaseOrderItem } from "@/types/models";

interface GoodsReceiptSummaryProps {
  goodsReceipt: GoodsReceipt;
  poItems: PurchaseOrderItem[];
}

/**
 * Ordered / Received / Damaged / Accepted, straight from the backend's
 * GoodsReceipt (backend-docs/receipts-api.md). `accepted` is never computed
 * here — matching decides what a shortfall costs, not this screen.
 */
export function GoodsReceiptSummary({ goodsReceipt, poItems }: GoodsReceiptSummaryProps) {
  const rows = deriveReceiptRows(goodsReceipt, poItems);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Goods Receipt</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(goodsReceipt.receivedAt)} · {goodsReceipt.receivedBy}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={goodsReceipt.status} />
          <DocumentActions
            fetcher={() => getReceiptPdf(goodsReceipt.id)}
            fallbackFilename={`goods-receipt-${goodsReceipt.id}.pdf`}
            title="Goods Receipt"
          />
        </div>
      </div>

      {goodsReceipt.notes && (
        <p className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
          {goodsReceipt.notes}
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <caption className="sr-only">Goods receipt line items: ordered, received, damaged and accepted quantities</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Item</TableHead>
              <TableHead scope="col" className="text-right">
                Ordered
              </TableHead>
              <TableHead scope="col" className="text-right">
                Received
              </TableHead>
              <TableHead scope="col" className="text-right">
                Damaged
              </TableHead>
              <TableHead scope="col" className="text-right">
                Accepted
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No receipt lines.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground">{row.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ordered}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.received}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.damaged}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.accepted}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
