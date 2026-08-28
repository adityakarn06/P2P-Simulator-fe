import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, InformationCircleIcon } from "@/lib/icons";

interface KpiTileProps {
  label: string;
  value: ReactNode;
  /** The numerator/denominator or basis behind the headline figure. */
  basis?: string;
  /** Shown behind an info icon — use it to qualify a figure that is easy to over-read. */
  note?: string;
  href?: string;
  isLoading?: boolean;
  className?: string;
}

/**
 * One headline analytics figure.
 *
 * `basis` exists because most numbers on this dashboard are rates, and a rate
 * without its denominator is unreadable — "80%" over four invoices and over
 * four hundred are very different claims. `note` exists because two of these
 * figures need a caveat to be honest (the touchless rate is invoice-side only).
 */
export function KpiTile({
  label,
  value,
  basis,
  note,
  href,
  isLoading = false,
  className,
}: KpiTileProps) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {note && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`About ${label}`}
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent className="max-w-xs text-pretty">{note}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-violet-300 text-violet-600 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/40"
            aria-label={`View ${label}`}
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
          </Link>
        )}
      </div>

      <div className="mt-3 text-2xl font-semibold tabular-nums">
        {isLoading ? <Skeleton className="h-8 w-24" /> : value}
      </div>

      {basis && !isLoading && (
        <p className="mt-1.5 text-xs text-muted-foreground">{basis}</p>
      )}
    </div>
  );
}
