import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/common/money";
import { cn } from "@/lib/utils";
import type { Sourcing, SupplierCandidate } from "@/types/models";
import { isSelected, splitCandidates, SCORE_WEIGHTS } from "@/lib/state/sourcing-state";

interface SupplierCandidatesTableProps {
  candidates: SupplierCandidate[];
  sourcing: Sourcing | null;
}

function ScoreCell({ value }: { value: number }) {
  return <TableCell className="text-right tabular-nums">{value.toFixed(2)}</TableCell>;
}

/**
 * Ranked supplier comparison. Eligibility is a hard gate, not a score — a
 * cheaper or faster supplier can still lose, and ineligible rows carry
 * all-zero `scores` because they were never scored (backend-docs/
 * sourcing-api.md). Those zeros must never be rendered as ratings.
 */
export function SupplierCandidatesTable({ candidates, sourcing }: SupplierCandidatesTableProps) {
  const { eligible, ineligible } = splitCandidates(candidates);
  const ordered = [...eligible, ...ineligible];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Eligibility is a hard gate, not a score — the weights below (price{" "}
        {SCORE_WEIGHTS.price}%, delivery {SCORE_WEIGHTS.delivery}%, reliability{" "}
        {SCORE_WEIGHTS.reliability}%, rating {SCORE_WEIGHTS.rating}%, stock{" "}
        {SCORE_WEIGHTS.stock}%) only apply once a supplier clears it, so a cheaper or
        faster ineligible supplier can still lose.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Eligible</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Delivery</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Price Score</TableHead>
            <TableHead className="text-right">Delivery Score</TableHead>
            <TableHead className="text-right">Reliability</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-right">Stock Score</TableHead>
            <TableHead className="text-right">Total Score</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordered.map((candidate) => {
            const selected = isSelected(candidate, sourcing);
            return (
              <TableRow
                key={candidate.supplierId}
                className={cn(
                  selected && "bg-primary/5 border-l-2 border-l-primary",
                  !candidate.eligible && "text-muted-foreground"
                )}
              >
                <TableCell className="tabular-nums">{candidate.rank}</TableCell>
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-1.5">
                    {candidate.supplierName}
                    {selected && (
                      <Badge variant="default" className="text-[10px]">
                        Selected
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={candidate.eligible ? "outline" : "destructive"}>
                    {candidate.eligible ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Money paise={candidate.unitPricePaise} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {candidate.deliveryDays}d
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {candidate.availableStock}
                </TableCell>
                {candidate.eligible ? (
                  <>
                    <ScoreCell value={candidate.scores.price} />
                    <ScoreCell value={candidate.scores.delivery} />
                    <ScoreCell value={candidate.scores.reliability} />
                    <ScoreCell value={candidate.scores.rating} />
                    <ScoreCell value={candidate.scores.stock} />
                    <ScoreCell value={candidate.scores.total} />
                    <TableCell className="text-muted-foreground">—</TableCell>
                  </>
                ) : (
                  <TableCell colSpan={7} className="text-muted-foreground whitespace-normal">
                    Not scored — {candidate.ineligibleReason}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
