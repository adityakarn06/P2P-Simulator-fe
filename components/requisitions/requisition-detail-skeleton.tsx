import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/common/loading-state";

/**
 * First-paint placeholder for /requisitions/[id], shaped like the real
 * two-column layout so nothing jumps once data arrives. Replaces a centred
 * full-page spinner.
 */
export function RequisitionDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="mt-4 lg:mt-0">
          <SkeletonCard className="space-y-4" />
        </div>
      </div>
      <span className="sr-only">Loading requisition…</span>
    </div>
  );
}
