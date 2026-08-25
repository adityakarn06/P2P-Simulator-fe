import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCheckVariance } from "@/lib/state/exception-state";
import { formatStatus } from "@/lib/formatters";
import type { ExceptionMatchCheck } from "@/types/models";

interface ExceptionChecksTableProps {
  checks: ExceptionMatchCheck[];
}

/**
 * Renders the raw MatchCheckResult rows behind a matching-originated
 * exception — the only place backend-docs/exceptions-api.md exposes the
 * specific expected/actual numbers. Never called with synthesised rows.
 */
export function ExceptionChecksTable({ checks }: ExceptionChecksTableProps) {
  if (checks.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Check</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((check, i) => (
            <TableRow key={`${check.checkType}-${i}`}>
              <TableCell className="font-medium">{formatStatus(check.checkType)}</TableCell>
              <TableCell className="text-muted-foreground">{check.expected}</TableCell>
              <TableCell className="text-muted-foreground">{check.actual}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCheckVariance(check.variance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
