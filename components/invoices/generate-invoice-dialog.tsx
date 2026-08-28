"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/common/error-state";
import { Spinner } from "@/components/common/loading-state";
import type { GenerateInvoiceRawLine } from "@/lib/state/invoice-state";
import type { PurchaseOrderItem } from "@/types/models";

interface GenerateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poItems: Pick<PurchaseOrderItem, "id" | "description" | "quantity">[];
  lines: GenerateInvoiceRawLine[];
  onLineQuantityChange: (purchaseOrderItemId: string, value: string) => void;
  fieldErrors: Record<string, string>;
  isPending?: boolean;
  error?: unknown;
  onConfirm: () => void;
}

/**
 * Optional quantity-override panel for POST
 * /purchase-orders/:id/generate-invoice (backend-docs/documents-api.md).
 * Leaving a line blank bills its full ordered quantity — only edited lines
 * are sent as overrides. Billing more than ordered is the way to demo a
 * QUANTITY_MISMATCH exception once the generated PDF is re-uploaded.
 */
export function GenerateInvoiceDialog({
  open,
  onOpenChange,
  poItems,
  lines,
  onLineQuantityChange,
  fieldErrors,
  isPending = false,
  error,
  onConfirm,
}: GenerateInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize quantities</DialogTitle>
          <DialogDescription>
            Leave a line blank to bill its full ordered quantity. Billing more than ordered is a
            way to demo a quantity-mismatch exception once the generated invoice is re-uploaded.
            A quantity must be 1 or more — every purchase-order line is billed, and a zero-total
            line would pass the unit-price check on no money at all.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {poItems.map((item) => {
            const line = lines.find((l) => l.purchaseOrderItemId === item.id);
            return (
              <div key={item.id} className="space-y-1.5">
                <Label htmlFor={`bill-qty-${item.id}`} className="text-xs">
                  {item.description}{" "}
                  <span className="font-normal text-muted-foreground">
                    (ordered {item.quantity})
                  </span>
                </Label>
                <Input
                  id={`bill-qty-${item.id}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder={String(item.quantity)}
                  value={line?.quantity ?? ""}
                  onChange={(e) => onLineQuantityChange(item.id, e.target.value)}
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors[item.id])}
                />
                {fieldErrors[item.id] && (
                  <p className="text-xs text-destructive">{fieldErrors[item.id]}</p>
                )}
              </div>
            );
          })}

          {error != null && <InlineError error={error} />}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isPending} className="gap-1.5">
            {isPending && <Spinner size="sm" />}
            Generate invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
