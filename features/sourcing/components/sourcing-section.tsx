import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert01Icon, ShoppingCart01Icon } from "@/lib/icons";
import { SourcingSummary } from "@/features/sourcing/components/sourcing-summary";
import { SupplierCandidatesTable } from "@/features/sourcing/components/supplier-candidates-table";
import { useExceptions } from "@/hooks/use-exceptions";
import { formatRelativeTime } from "@/lib/formatters";
import type { Requisition } from "@/types/models";

interface SourcingSectionProps {
  requisition: Pick<
    Requisition,
    "id" | "status" | "sourcing" | "supplierCandidates" | "failureReason"
  >;
}

/**
 * Supplier discovery adds no endpoints of its own — everything here is read
 * off GET /requisitions/:id (sourcing + supplierCandidates). See
 * backend-docs/sourcing-api.md.
 */
export function SourcingSection({ requisition }: SourcingSectionProps) {
  const { id, status, sourcing, supplierCandidates, failureReason } = requisition;

  // Sourcing failure also writes a NO_SUPPLIER_FOUND exception, fetchable
  // "in addition to failureReason" — backend-docs/sourcing-api.md. Render it
  // alongside the prose, not in place of it.
  const { data: failureExceptions } = useExceptions(
    { entityId: id, limit: 5 },
    { enabled: status === "FAILED" }
  );

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

        {failureExceptions?.items.map((exception) => (
          <div
            key={exception.id}
            className="flex items-center gap-2 rounded-md border p-3 text-xs text-muted-foreground"
          >
            <StatusBadge status={exception.severity} />
            <StatusBadge status={exception.status} />
            <span className="font-mono">{exception.type.replace(/_/g, " ")}</span>
            <span className="ml-auto">{formatRelativeTime(exception.createdAt)}</span>
          </div>
        ))}

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
