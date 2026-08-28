"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonLines } from "@/components/common/loading-state";
import { anomalyToneClass } from "@/lib/state/analytics-state";
import { formatRelativeTime, formatStatus } from "@/lib/formatters";
import { ANOMALY_FILTER_ALL } from "@/store/dashboard-store";
import { cn } from "@/lib/utils";
import type {
  AnomalySeverity,
  AnomalySignal,
  AnomalySignalType,
} from "@/types/analytics";

const SEVERITIES: AnomalySeverity[] = ["CRITICAL", "WARNING", "INFO"];

const SIGNAL_TYPES: AnomalySignalType[] = [
  "PRICE_OUTLIER",
  "QUANTITY_OUTLIER",
  "NEW_SUPPLIER_HIGH_VALUE",
  "PREDICTED_LATE_DELIVERY",
  "SUPPLIER_DEGRADATION",
  "NEAR_DUPLICATE_INVOICE",
];

type Filter<T> = T | typeof ANOMALY_FILTER_ALL;

/** Where a signal's entity can be opened, or null when it has no detail screen. */
function signalHref(signal: AnomalySignal): string | null {
  switch (signal.entityType) {
    case "PurchaseOrder":
      return `/purchase-orders/${signal.entityId}`;
    case "Invoice":
      return `/invoices/${signal.entityId}`;
    case "Requisition":
      return `/requisitions/${signal.entityId}`;
    default:
      // Supplier signals (SUPPLIER_DEGRADATION) have no detail route — the
      // scorecard above is where that story lives.
      return null;
  }
}

interface AnomalyFeedProps {
  signals: AnomalySignal[];
  isLoading?: boolean;
  severity: Filter<AnomalySeverity>;
  onSeverityChange: (v: Filter<AnomalySeverity>) => void;
  signalType: Filter<AnomalySignalType>;
  onSignalTypeChange: (v: Filter<AnomalySignalType>) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
}

/**
 * The advisory signal feed.
 *
 * Everything about the presentation is deliberately calmer than the exceptions
 * inbox, because a signal is *not* a blocker: it never blocks a payment, never
 * raises an Exception, and never changes a three-way-match verdict. Rendering
 * these as alerts would misrepresent how the system works and would imply money
 * is being held that isn't.
 *
 * Each signal ships with its own `explanation` sentence — these are
 * deterministic statistics over the organization's own history, not a model, so
 * the prose is always exact and is rendered rather than reconstructed.
 */
export function AnomalyFeed({
  signals,
  isLoading,
  severity,
  onSeverityChange,
  signalType,
  onSignalTypeChange,
  hasMore,
  onLoadMore,
  isLoadingMore,
}: AnomalyFeedProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={severity}
          onValueChange={(v) => onSeverityChange(v as Filter<AnomalySeverity>)}
        >
          <SelectTrigger aria-label="Severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANOMALY_FILTER_ALL}>All severities</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {formatStatus(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={signalType}
          onValueChange={(v) => onSignalTypeChange(v as Filter<AnomalySignalType>)}
        >
          <SelectTrigger aria-label="Signal type">
            <SelectValue placeholder="Signal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANOMALY_FILTER_ALL}>All signals</SelectItem>
            {SIGNAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {formatStatus(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <SkeletonLines lines={4} />
      ) : signals.length === 0 ? (
        <EmptyState
          title="No signals raised"
          description="Outlier detection needs at least 3 prior observations before it will report anything."
          className="py-10"
        />
      ) : (
        <ul className="space-y-2">
          {signals.map((signal) => {
            const href = signalHref(signal);
            return (
              <li
                key={signal.id}
                className={cn("rounded-lg bg-muted/30 p-3", anomalyToneClass(signal.severity))}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[11px]">
                    {formatStatus(signal.signalType)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatStatus(signal.severity)} · {formatRelativeTime(signal.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-sm text-pretty">{signal.explanation}</p>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Observed <span className="text-foreground">{signal.observed}</span>
                  </span>
                  <span>
                    Baseline <span className="text-foreground">{signal.baseline}</span>
                  </span>
                  {href && (
                    <Link href={href} className="font-medium text-primary hover:underline">
                      Open {formatStatus(signal.entityType).toLowerCase()}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
