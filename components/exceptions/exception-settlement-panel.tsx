import Link from "next/link";
import { Money } from "@/components/common/money";
import { getMaxApprovableAmountPaise } from "@/lib/state/exception-state";
import type { ExceptionSettlement } from "@/types/models";

interface ExceptionSettlementPanelProps {
  settlement: ExceptionSettlement;
}

interface BalanceProps {
  label: string;
  totalPaise: number;
  settledPaise: number;
  outstandingPaise: number;
}

function Balance({ label, totalPaise, settledPaise, outstandingPaise }: BalanceProps) {
  // Guarded against a zero total so an invoice whose amount was never extracted
  // renders an empty bar rather than NaN.
  const percent = totalPaise > 0 ? Math.min(100, (settledPaise / totalPaise) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          <Money paise={settledPaise} /> of <Money paise={totalPaise} />
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <Money paise={outstandingPaise} /> outstanding
      </p>
    </div>
  );
}

/**
 * What settling this exception's invoice would cost, from the `settlement`
 * block on GET /exceptions/:id.
 *
 * The invoice and purchase order balances are shown separately on purpose: they
 * answer different questions — "has the supplier been paid what they billed?"
 * versus "has this commitment been spent?" — and a partial approval is capped
 * by whichever binds first.
 */
export function ExceptionSettlementPanel({ settlement }: ExceptionSettlementPanelProps) {
  const maxApprovable = getMaxApprovableAmountPaise(settlement);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Settlement</p>
          <p className="text-xs text-muted-foreground">
            Against{" "}
            <Link
              href={`/purchase-orders/${settlement.purchaseOrderId}`}
              className="font-mono hover:underline"
            >
              {settlement.poNumber}
            </Link>
          </p>
        </div>
        {settlement.fullySettled && (
          <p className="text-xs text-muted-foreground">Fully settled</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Balance
          label="Invoice"
          totalPaise={settlement.invoiceTotalPaise}
          settledPaise={settlement.invoiceSettledPaise}
          outstandingPaise={settlement.invoiceOutstandingPaise}
        />
        <Balance
          label="Purchase order"
          totalPaise={settlement.purchaseOrderTotalPaise}
          settledPaise={settlement.purchaseOrderSettledPaise}
          outstandingPaise={settlement.purchaseOrderOutstandingPaise}
        />
      </div>

      {settlement.suggestedAmountPaise != null ? (
        <p className="text-xs text-muted-foreground">
          Suggested partial payment{" "}
          <Money paise={settlement.suggestedAmountPaise} className="font-medium text-foreground" />
          {" — "}accepted units at the purchase order&rsquo;s agreed unit price plus tax at
          the order&rsquo;s rate. Priced off the order rather than the invoice, so an inflated
          invoice price is not inherited. Advisory: the amount is re-checked against both
          balances (maximum <Money paise={maxApprovable} />) before anything is charged.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No partial payment can be suggested — nothing has been received yet, the invoice
          total was never extracted, or the invoice or purchase order is already settled.
        </p>
      )}
    </div>
  );
}
