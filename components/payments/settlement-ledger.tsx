import { Money } from "@/components/common/money";
import { toLedgerLines } from "@/lib/state/payment-state";
import type { PaymentLedger } from "@/types/payments";

interface SettlementLedgerProps {
  ledger: PaymentLedger;
}

/**
 * The order-level ledger from GET /payments/:id.
 *
 * The invoice and purchase order balances stay separate because they answer
 * different questions, and because the automatic settlement pays the *order's*
 * remaining balance rather than the invoice's — the order total is the buyer's
 * own calculated figure, while the invoice total was transcribed off a document
 * by OCR and never decides how much money moves.
 */
export function SettlementLedger({ ledger }: SettlementLedgerProps) {
  const lines = toLedgerLines(ledger);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Settlement ledger</p>
        <p className="text-xs text-muted-foreground">
          {ledger.fullySettled ? "Fully settled" : "Balance outstanding"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lines.map((line) => {
          const percent =
            line.totalPaise > 0
              ? Math.min(100, (line.settledPaise / line.totalPaise) * 100)
              : 0;
          return (
            <div key={line.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium">{line.label}</p>
                <p className="text-xs text-muted-foreground">
                  <Money paise={line.settledPaise} /> of{" "}
                  <Money paise={line.totalPaise} />
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                <Money paise={line.outstandingPaise} /> outstanding
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
