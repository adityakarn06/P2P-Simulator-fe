"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { formatDateTime, formatRelativeTime } from "@/lib/formatters";
import { describeAuditLog, getAuditActorLabel } from "@/lib/state/activity-state";
import { ActivityIcon, AiSparklesIcon, CpuIcon, UserCircle02Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { AuditActorType, AuditLog } from "@/types/models";

const actorIconMap: Record<AuditActorType, IconSvgElement> = {
  SYSTEM: CpuIcon,
  AI: AiSparklesIcon,
  USER: UserCircle02Icon,
};

function ActorChip({ log }: { log: AuditLog }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <HugeiconsIcon icon={actorIconMap[log.actorType]} className="size-3.5" />
      {getAuditActorLabel(log.actorType)}
      {log.actorId && <span className="font-mono text-muted-foreground/80">· {log.actorId}</span>}
    </span>
  );
}

function ActivityRow({ log, isLast }: { log: AuditLog; isLast: boolean }) {
  const { label, detail } = describeAuditLog(log);

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
        {!isLast && <span className="w-px flex-1 bg-border" aria-hidden="true" />}
      </div>

      <div className="flex-1 space-y-1 pb-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          <span
            className="text-xs text-muted-foreground tabular-nums whitespace-nowrap"
            title={formatDateTime(log.createdAt)}
          >
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ActorChip log={log} />
          <span className="text-xs text-muted-foreground">
            {log.entityType} <span className="font-mono text-muted-foreground/70">{log.entityId}</span>
          </span>
        </div>

        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </li>
  );
}

interface ActivityTimelineProps {
  rows: AuditLog[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  className?: string;
}

/**
 * Presentational, newest-first activity timeline for a set of audit-log
 * rows. Reusable across the requisition detail page and, later, any other
 * entity's detail view.
 */
export function ActivityTimeline({ rows, isLoading, isError, error, className }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    );
  }

  if (isError) {
    return <InlineError error={error} className={className} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity yet"
        description="Workflow events will appear here as this requisition progresses."
        className={cn("p-6", className)}
      />
    );
  }

  return (
    <ol className={className}>
      {rows.map((log, index) => (
        <ActivityRow key={log.id} log={log} isLast={index === rows.length - 1} />
      ))}
    </ol>
  );
}
