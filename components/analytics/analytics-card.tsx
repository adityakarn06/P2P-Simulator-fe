import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
  title: string;
  /** The one-line qualification that keeps the figure honest. Rendered under the title. */
  caption?: string;
  actions?: ReactNode;
  isLoading?: boolean;
  /** When true, renders `emptyMessage` instead of children. */
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared frame for a dashboard section.
 *
 * `caption` is a first-class prop rather than an afterthought: nearly every
 * figure on this screen means something narrower than its title suggests
 * (generated invoices excluded from the funnel, OTIF being an approximation,
 * anomalies being advisory), and the caption is where that gets said.
 */
export function AnalyticsCard({
  title,
  caption,
  actions,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "Nothing recorded yet.",
  children,
  className,
}: AnalyticsCardProps) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {caption && (
            <p className="mt-0.5 text-xs text-pretty text-muted-foreground">{caption}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : isEmpty ? (
          <EmptyState title={emptyMessage} />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
