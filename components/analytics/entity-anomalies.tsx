"use client";

import { Callout } from "@/components/common/callout";
import { useAnomalies } from "@/hooks/use-analytics";
import { formatStatus } from "@/lib/formatters";
import type { EntityType } from "@/types/models";

/**
 * Advisory signals raised against one record, rendered inline where that record
 * lives.
 *
 * Deliberately a low-key note, never an alert. A signal does not block a
 * payment, raise an exception, or change a match verdict — three-way matching
 * is the only financial gate. Styling these like a blocker would tell an
 * approver money is being held when it isn't, so the "Advisory" label is part
 * of the component rather than something each caller has to remember.
 *
 * Renders nothing when there are no signals, which is the common case: no
 * outlier fires with fewer than three prior observations.
 */
export function EntityAnomalies({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const { data } = useAnomalies({ entityType, entityId, limit: 10 });
  const signals = data?.items ?? [];

  if (signals.length === 0) return null;

  return (
    <Callout tone="info">
      <p className="text-xs font-medium text-muted-foreground">
        Advisory signals — these do not block approval or payment
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {signals.map((signal) => (
          <li key={signal.id} className="text-sm text-pretty">
            <span className="font-medium">{formatStatus(signal.signalType)}:</span>{" "}
            {signal.explanation}
          </li>
        ))}
      </ul>
    </Callout>
  );
}
