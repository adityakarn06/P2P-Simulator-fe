import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCurrencyFromPaise } from "@/lib/formatters";
import { formatDeliveryDeadline } from "@/lib/state/requisition-state";
import type { Requirement } from "@/types/models";

interface RequirementsCardProps {
  requirement: Requirement;
  /**
   * ISO 8601 — anchor for the delivery deadline. `deliveryDeadlineDays` is
   * "days from now" as of extraction, so this should be the extraction
   * turn's timestamp (the last message), not the requisition's createdAt.
   */
  sinceIso: string;
  className?: string;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Just the requirement fields — no card chrome. Composes inside a
 * WorkflowSection on /requisitions/[id] rather than owning its own Card, so
 * it collapses and carries a header badge like every other stage.
 */
export function RequirementsCard({ requirement, sinceIso, className }: RequirementsCardProps) {
  const specEntries = Object.entries(requirement.specifications ?? {});

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-xs text-muted-foreground">
        Extracted from your request — final, no longer editable via chat.
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Product" value={requirement.productName} />
        <Field label="Quantity" value={requirement.quantity.toLocaleString("en-IN")} />
        <Field
          label="Maximum Unit Price"
          value={formatCurrencyFromPaise(requirement.maxUnitPricePaise)}
        />
        <Field label="Currency" value={requirement.currency} />
        <Field
          label="Delivery Deadline"
          value={formatDeliveryDeadline(requirement.deliveryDeadlineDays, sinceIso)}
        />
        <Field label="Location" value={requirement.deliveryLocation ?? "Not specified"} />
      </dl>

      <div className="space-y-1.5 border-t pt-3">
        <p className="text-xs text-muted-foreground">Specifications</p>
        {specEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">None specified</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {specEntries.map(([key, value]) => (
              <Field key={key} label={key} value={String(value)} />
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
