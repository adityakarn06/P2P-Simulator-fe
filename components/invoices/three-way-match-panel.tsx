"use client";

import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Callout } from "@/components/common/callout";
import { formatCurrencyFromPaise } from "@/lib/formatters";
import {
  deriveThreeWayMatch,
  matchOutcome,
  type MatchOutcome,
  type MatchRow,
} from "@/lib/state/match-state";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { TickDouble01Icon, Cancel01Icon } from "@/lib/icons";
import type { Exception, GoodsReceipt, Invoice, PurchaseOrder } from "@/types/models";

/** Money rows carry raw paise strings; everything else is already display-ready. */
const MONEY_ROW_KEYS = new Set(["Unit price", "Line total", "Subtotal", "Tax", "Total"]);

function renderValue(row: MatchRow, value: string | null): string {
  if (value == null) return "—";
  if (MONEY_ROW_KEYS.has(row.label)) return formatCurrencyFromPaise(Number(value));
  return value;
}

function ValueCell({ row, value }: { row: MatchRow; value: string | null }) {
  return (
    <TableCell
      className={cn(
        "tabular-nums",
        value == null && "text-muted-foreground",
        row.status === "mismatch" && value != null && "font-medium text-red-600 dark:text-red-400"
      )}
    >
      {renderValue(row, value)}
    </TableCell>
  );
}

function MatchRows({ rows }: { rows: MatchRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <TableRow key={row.key}>
          <TableCell className="text-muted-foreground">{row.label}</TableCell>
          <ValueCell row={row} value={row.ordered} />
          <ValueCell row={row} value={row.received} />
          <ValueCell row={row} value={row.invoiced} />
          <TableCell className="text-right">
            {row.status === "match" && (
              <HugeiconsIcon
                icon={TickDouble01Icon}
                className="ml-auto size-4 text-emerald-600"
                aria-label="Agrees"
              />
            )}
            {row.status === "mismatch" && (
              <HugeiconsIcon
                icon={Cancel01Icon}
                className="ml-auto size-4 text-red-600"
                aria-label="Differs"
              />
            )}
            {row.status === "unavailable" && (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function OutcomeBanner({ outcome, hasReceipt }: { outcome: MatchOutcome; hasReceipt: boolean }) {
  switch (outcome) {
    case "passed":
      return (
        <Callout tone="success">
          <span className="font-medium">3-way match passed.</span> The backend matched this
          invoice against its purchase order and goods receipt and released it for payment
          with no exception raised.
        </Callout>
      );
    case "exception":
      return (
        <Callout tone="warning">
          <span className="font-medium">Matching raised an exception.</span> Payment is held
          until it is decided. The failing rows below show where the documents disagree.
        </Callout>
      );
    case "failed":
      return (
        <Callout tone="error">
          <span className="font-medium">Extraction failed.</span> Nothing could be read off
          this document, so it was never matched.
        </Callout>
      );
    default:
      return (
        <Callout tone={hasReceipt ? "progress" : "info"}>
          <span className="font-medium">
            {hasReceipt ? "Matching in progress." : "Awaiting goods receipt."}
          </span>{" "}
          {hasReceipt
            ? "The matching worker has not returned a verdict yet."
            : "Only the purchase order and invoice can be compared until delivery is recorded."}
        </Callout>
      );
  }
}

interface ThreeWayMatchPanelProps {
  purchaseOrder: PurchaseOrder;
  goodsReceipt: GoodsReceipt | null;
  invoice: Invoice;
  /** The invoice's exceptions — an open one means matching did not pass. */
  exceptions?: Pick<Exception, "status">[];
}

/**
 * Side-by-side reconciliation of the three documents three-way matching compares.
 *
 * The caption is not decoration. The API exposes no read endpoint for a
 * ThreeWayMatch — a passing match's check breakdown is not fetchable anywhere,
 * and only *failed* checks surface, through an exception's metadata. So the
 * comparison below is the client's own arithmetic over documents it already
 * holds, and it must never be presented as the backend's verdict. The banner
 * above it is the verdict, and that comes from the invoice's real status.
 */
export function ThreeWayMatchPanel({
  purchaseOrder,
  goodsReceipt,
  invoice,
  exceptions = [],
}: ThreeWayMatchPanelProps) {
  const view = deriveThreeWayMatch(purchaseOrder, goodsReceipt, invoice);
  const outcome = matchOutcome(invoice, exceptions);

  return (
    <div className="space-y-3">
      <OutcomeBanner outcome={outcome} hasReceipt={view.hasReceipt} />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32" />
              <TableHead>Purchase order</TableHead>
              <TableHead>Goods receipt</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.lines.map((line) => (
              <Fragment key={line.description}>
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={5} className="text-xs font-medium">
                    {line.description}
                  </TableCell>
                </TableRow>
                <MatchRows rows={line.rows} />
              </Fragment>
            ))}

            <TableRow className="bg-muted/40">
              <TableCell colSpan={5} className="text-xs font-medium">
                Totals
              </TableCell>
            </TableRow>
            <MatchRows rows={view.totals} />
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-pretty text-muted-foreground">
        Client-side reconciliation of the documents on file — not the backend&rsquo;s match
        verdict. A passing match&rsquo;s full check breakdown is not exposed by the API; only
        failed checks are, through the exception they raised.
        {!view.hasReceipt &&
          " No goods receipt exists yet, so this compares the purchase order and invoice only."}
      </p>
    </div>
  );
}
