import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatCurrencyFromPaise } from "@/lib/formatters";
import { formatDeliveryDeadline } from "@/features/requisitions/lib/requisition-state";
import type { Requirement } from "@/types/models";

interface RequirementsCardProps {
  requirement: Requirement;
  /** ISO 8601 — the requisition's createdAt, used as the deadline anchor. */
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

export function RequirementsCard({ requirement, sinceIso, className }: RequirementsCardProps) {
  const specEntries = Object.entries(requirement.specifications ?? {});

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Requirements</CardTitle>
        <CardDescription>Extracted from your request — final, no longer editable via chat.</CardDescription>
      </CardHeader>
      <CardContent>
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

        <div className="mt-4 space-y-1.5 border-t pt-3">
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
      </CardContent>
    </Card>
  );
}
