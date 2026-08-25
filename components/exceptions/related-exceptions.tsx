import Link from "next/link";
import { StatusBadge } from "@/components/common/status-badge";
import type { Exception } from "@/types/models";

interface RelatedExceptionsProps {
  exceptions: Exception[];
}

/**
 * "Still blocking this invoice" — the other OPEN exceptions on the same
 * invoice. Per backend-docs/exceptions-api.md: approving one exception does
 * not release the invoice while others remain open, so this panel is what
 * keeps them visible rather than treating a single resolve as final.
 */
export function RelatedExceptions({ exceptions }: RelatedExceptionsProps) {
  if (exceptions.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="mb-2 text-sm font-medium">
        Still blocking this invoice ({exceptions.length})
      </p>
      <ul className="space-y-1.5">
        {exceptions.map((exception) => (
          <li key={exception.id}>
            <Link
              href={`/exceptions/${exception.id}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <StatusBadge status={exception.severity} />
              <span className="truncate text-muted-foreground">{exception.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
