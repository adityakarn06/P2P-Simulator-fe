import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCheckVariance } from "@/lib/state/exception-state";
import { formatStatus } from "@/lib/formatters";
import type { ExceptionMatchCheck } from "@/types/models";

interface ExceptionChecksTableProps {
  checks: ExceptionMatchCheck[];
}

/**
 * Renders the failing MatchCheckResult rows behind a matching-originated
 * exception — the only place backend-docs/exceptions-api.md exposes the
 * specific expected/actual numbers. Never called with synthesised rows.
 *
 * `severity` only comes back on `GET /exceptions/:id`'s `failedChecks`, so the
 * column is dropped entirely when no row carries one rather than rendering a
 * column of dashes.
 */
export function ExceptionChecksTable({ checks }: ExceptionChecksTableProps) {
  if (checks.length === 0) return null;

  const hasSeverity = checks.some((check) => check.severity != null);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Check</TableHead>
            {hasSeverity && <TableHead>Severity</TableHead>}
            <TableHead>Expected</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {checks.map((check, i) => (
            <TableRow key={`${check.checkType}-${i}`}>
              <TableCell className="font-medium">{formatStatus(check.checkType)}</TableCell>
              {hasSeverity && (
                <TableCell>
                  {check.severity ? (
                    <StatusBadge status={check.severity} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
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
