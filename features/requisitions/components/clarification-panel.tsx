import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@/lib/icons";
import { missingFieldLabel } from "@/features/requisitions/lib/requisition-state";

interface ClarificationPanelProps {
  missingFields: string[];
  conflicts: string[];
}

export function ClarificationPanel({ missingFields, conflicts }: ClarificationPanelProps) {
  if (missingFields.length === 0 && conflicts.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      {missingFields.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Still needed</p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map((field) => (
              <Badge
                key={field}
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                {missingFieldLabel(field)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Conflicts to resolve</p>
          <ul className="space-y-1">
            {conflicts.map((conflict, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-sm text-destructive">
                <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0" />
                <span>{conflict}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
