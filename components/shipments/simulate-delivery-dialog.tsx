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
import { cn } from "@/lib/utils";
import type { ReceiptConflict } from "@/lib/state/shipment-state";

/** One PO line's controlled form state for the multi-line dialog. */
export interface MultiLineDialogItem {
  purchaseOrderItemId: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: string;
  damagedQuantity: string;
}

interface SimulateDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single-line mode (default) — omit `items` to use this. */
  orderedQuantity: number;
  receivedQuantity: string;
  onReceivedQuantityChange: (value: string) => void;
  damagedQuantity: string;
  onDamagedQuantityChange: (value: string) => void;
  /**
   * Multi-line mode — when present, renders one received/damaged row per PO
   * line instead of the single-line fields above.
   */
  items?: MultiLineDialogItem[];
  onItemReceivedQuantityChange?: (purchaseOrderItemId: string, value: string) => void;
  onItemDamagedQuantityChange?: (purchaseOrderItemId: string, value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  fieldErrors: Record<string, string>;
  conflict: ReceiptConflict | null;
  onConfirm: () => void;
  isPending?: boolean;
  error?: unknown;
}

/** Renders a recorded/submitted quantity object as "received X, damaged Y", best-effort. */
function formatConflictSide(value: unknown): string {
  if (typeof value !== "object" || value === null) return String(value);
  const v = value as Record<string, unknown>;
  const parts: string[] = [];
  if ("receivedQuantity" in v) parts.push(`received ${String(v.receivedQuantity)}`);
  if ("damagedQuantity" in v) parts.push(`damaged ${String(v.damagedQuantity)}`);
  return parts.length > 0 ? parts.join(", ") : JSON.stringify(v);
}

export function SimulateDeliveryDialog({
  open,
  onOpenChange,
  orderedQuantity,
  receivedQuantity,
  onReceivedQuantityChange,
  damagedQuantity,
  onDamagedQuantityChange,
  items,
  onItemReceivedQuantityChange,
  onItemDamagedQuantityChange,
  notes,
  onNotesChange,
  fieldErrors,
  conflict,
  onConfirm,
  isPending = false,
  error,
}: SimulateDeliveryDialogProps) {
  const multiLine = items != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(multiLine ? "sm:max-w-lg" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>Simulate delivery</DialogTitle>
          <DialogDescription>
            {multiLine
              ? "Record what arrived for each line on this shipment."
              : `Record what arrived for this shipment. Ordered quantity is ${orderedQuantity}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {conflict && (
            <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-xs font-medium text-destructive">
                A delivery was already recorded with different quantities
              </p>
              <p className="text-xs text-destructive/90">
                Recorded: {formatConflictSide(conflict.recorded)}
              </p>
              <p className="text-xs text-destructive/90">
                Submitted: {formatConflictSide(conflict.submitted)}
              </p>
              <p className="text-xs text-muted-foreground">
                A receipt is immutable and cannot be corrected here — this is a matching
                exception for a human to resolve.
              </p>
            </div>
          )}

          {multiLine ? (
            <div className="space-y-3">
              {fieldErrors.items && (
                <p className="text-xs text-destructive">{fieldErrors.items}</p>
              )}
              {items.map((item, index) => (
                <div
                  key={item.purchaseOrderItemId}
                  className="space-y-2 rounded-md border p-3"
                >
                  <p className="text-xs font-medium text-foreground">
                    {item.description}{" "}
                    <span className="font-normal text-muted-foreground">
                      (ordered {item.orderedQuantity})
                    </span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`received-${item.purchaseOrderItemId}`} className="text-xs">
                        Received
                      </Label>
                      <Input
                        id={`received-${item.purchaseOrderItemId}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={item.receivedQuantity}
                        onChange={(e) =>
                          onItemReceivedQuantityChange?.(item.purchaseOrderItemId, e.target.value)
                        }
                        disabled={isPending}
                        aria-invalid={Boolean(fieldErrors[`items.${index}.receivedQuantity`])}
                      />
                      {fieldErrors[`items.${index}.receivedQuantity`] && (
                        <p className="text-xs text-destructive">
                          {fieldErrors[`items.${index}.receivedQuantity`]}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`damaged-${item.purchaseOrderItemId}`} className="text-xs">
                        Damaged
                      </Label>
                      <Input
                        id={`damaged-${item.purchaseOrderItemId}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={item.damagedQuantity}
                        onChange={(e) =>
                          onItemDamagedQuantityChange?.(item.purchaseOrderItemId, e.target.value)
                        }
                        disabled={isPending}
                        aria-invalid={Boolean(fieldErrors[`items.${index}.damagedQuantity`])}
                      />
                      {fieldErrors[`items.${index}.damagedQuantity`] && (
                        <p className="text-xs text-destructive">
                          {fieldErrors[`items.${index}.damagedQuantity`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="received-quantity">Received quantity</Label>
                <Input
                  id="received-quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={receivedQuantity}
                  onChange={(e) => onReceivedQuantityChange(e.target.value)}
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.receivedQuantity)}
                />
                {fieldErrors.receivedQuantity && (
                  <p className="text-xs text-destructive">{fieldErrors.receivedQuantity}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="damaged-quantity">Damaged quantity</Label>
                <Input
                  id="damaged-quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={damagedQuantity}
                  onChange={(e) => onDamagedQuantityChange(e.target.value)}
                  disabled={isPending}
                  aria-invalid={Boolean(fieldErrors.damagedQuantity)}
                />
                {fieldErrors.damagedQuantity && (
                  <p className="text-xs text-destructive">{fieldErrors.damagedQuantity}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="receipt-notes">Notes</Label>
            <textarea
              id="receipt-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isPending}
              placeholder="Optional — e.g. two units crushed in transit"
              className={cn(
                "w-full resize-none rounded-md border border-input bg-input/20 px-2 py-1.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              )}
            />
            <p className="text-right text-xs text-muted-foreground">{notes.trim().length}/500</p>
          </div>

          {error != null && !conflict && <InlineError error={error} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isPending} className="gap-1.5">
            {isPending && <Spinner size="sm" />}
            Confirm Delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
