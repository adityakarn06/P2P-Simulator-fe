import type { Sourcing, SupplierCandidate } from "@/types/models";

interface SourcingSummaryProps {
  sourcing: Sourcing;
  candidates: SupplierCandidate[];
}

/**
 * Selected supplier, headline score, evaluation count, and the AI rationale
 * — the four fields backend-docs/sourcing-api.md calls out as most
 * demo-legible. Rationale is rendered verbatim, never parsed.
 */
export function SourcingSummary({ sourcing, candidates }: SourcingSummaryProps) {
  // sourcing.selectedSupplier.name is only null if the candidate row is
  // missing — fall back to the rank-1 candidate's name in that case.
  const winnerName =
    sourcing.selectedSupplier.name ??
    candidates.find((c) => c.supplierId === sourcing.selectedSupplier.id)?.supplierName ??
    "Selected supplier";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Selected supplier</p>
          <p className="text-sm font-medium">{winnerName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total score</p>
          <p className="text-sm font-medium tabular-nums">{sourcing.totalScore.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Candidates evaluated</p>
          <p className="text-sm font-medium tabular-nums">{sourcing.candidatesEvaluated}</p>
        </div>
      </div>

      {sourcing.rationale && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">Why this supplier</p>
          <p className="mt-1 text-sm leading-relaxed">{sourcing.rationale}</p>
        </div>
      )}
    </div>
  );
}
