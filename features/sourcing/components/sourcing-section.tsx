import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, ShoppingCart01Icon } from "@/lib/icons";
import { SourcingSummary } from "@/features/sourcing/components/sourcing-summary";
import { SupplierCandidatesTable } from "@/features/sourcing/components/supplier-candidates-table";
import type { Requisition } from "@/types/models";

interface SourcingSectionProps {
  requisition: Pick<
    Requisition,
    "status" | "sourcing" | "supplierCandidates" | "failureReason"
  >;
}

/**
 * Supplier discovery adds no endpoints of its own — everything here is read
 * off GET /requisitions/:id (sourcing + supplierCandidates). See
 * backend-docs/sourcing-api.md.
 */
export function SourcingSection({ requisition }: SourcingSectionProps) {
  const { status, sourcing, supplierCandidates, failureReason } = requisition;

  // Sourcing is running: transient, not a resting state.
  if (status === "REQUIREMENTS_EXTRACTED") {
    return <LoadingState message="Finding suppliers…" className="p-6" />;
  }

  if (status === "FAILED" && sourcing == null) {
    return (
      <div className="space-y-4">
        {failureReason && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0" />
            <p>{failureReason}</p>
          </div>
        )}

        {supplierCandidates.length > 0 ? (
          <SupplierCandidatesTable candidates={supplierCandidates} sourcing={null} />
        ) : (
          <EmptyState
            icon={ShoppingCart01Icon}
            title="No suppliers evaluated"
            description="Discovery failed before any supplier could be evaluated — often because the request doesn't match a catalog product."
          />
        )}
      </div>
    );
  }

  if (sourcing == null) {
    return (
      <EmptyState
        icon={ShoppingCart01Icon}
        title="Supplier discovery hasn't run yet"
        description="This section fills in automatically once requirements are complete."
      />
    );
  }

  return (
    <div className="space-y-4">
      <SourcingSummary sourcing={sourcing} candidates={supplierCandidates} />
      <SupplierCandidatesTable candidates={supplierCandidates} sourcing={sourcing} />
    </div>
  );
}
