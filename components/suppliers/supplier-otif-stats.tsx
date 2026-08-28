import { Money } from "@/components/common/money";
import {
  formatRate,
  formatReliabilityDelta,
  getAcceptanceRate,
  getInFullRate,
  getOnTimeRate,
  getReliabilityDelta,
} from "@/lib/state/catalog-state";
import type { Supplier } from "@/types/catalog";
import type { SupplierScorecardRow } from "@/types/analytics";

interface SupplierOtifStatsProps {
  supplier: Supplier;
  /**
   * The row GET /analytics/suppliers returns, passed straight through from
   * GET /suppliers/:id. Null for a supplier with no scorecard yet — the OTIF
   * counters on the supplier itself are still shown in that case.
   */
  scorecard: SupplierScorecardRow | null;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Delivery performance for one supplier.
 *
 * Rates are null — rendered as an em dash, never "0%" — for a supplier that has
 * never delivered: a new vendor has not failed to deliver on time, and a zero
 * would read as a damning record it has not earned.
 */
export function SupplierOtifStats({ supplier, scorecard }: SupplierOtifStatsProps) {
  const delta = getReliabilityDelta(supplier);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">Delivery performance</p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="On time"
          value={formatRate(getOnTimeRate(supplier))}
          hint={`${supplier.onTimeDeliveries} of ${supplier.totalDeliveries}`}
        />
        <Stat
          label="In full"
          value={formatRate(getInFullRate(supplier))}
          hint={`${supplier.inFullDeliveries} of ${supplier.totalDeliveries}`}
        />
        <Stat
          label="Units accepted"
          value={formatRate(getAcceptanceRate(supplier))}
          hint={`${supplier.damagedUnits} damaged of ${supplier.orderedUnits}`}
        />
        <Stat
          label="Avg lead time"
          value={supplier.avgLeadTimeDays != null ? `${supplier.avgLeadTimeDays} days` : "—"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
        <Stat
          label="Reliability"
          value={formatRate(supplier.reliabilityScore)}
          hint={`${formatReliabilityDelta(delta)} vs baseline`}
        />
        <Stat label="Rating" value={`${supplier.rating.toFixed(1)} / 5`} />
        {scorecard && (
          <>
            <Stat label="Purchase orders" value={String(scorecard.purchaseOrders)} />
            <div>
              <p className="text-xs text-muted-foreground">Spend</p>
              <p className="text-sm font-medium">
                <Money paise={scorecard.spend.paise} />
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
