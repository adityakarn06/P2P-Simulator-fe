import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, Alert01Icon } from "@/lib/icons";
import { ProcessingIndicator } from "@/components/workflow/processing-indicator";

export type WorkflowStepStatus = "completed" | "active" | "pending" | "failed";

export interface WorkflowStage {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  /** ISO 8601 timestamp */
  timestamp?: string | null;
  /** Short context note rendered below the label */
  note?: string | null;
  /**
   * "What's happening right now" caption — a worker-running label ("AI
   * processing…") or a human-gated one ("Awaiting your approval"). Only
   * ever set on the active stage; never a percentage or an ETA. See
   * lib/state/requisition-state.ts's getWorkerActivity/getAwaitingAction.
   */
  activity?: { label: string; variant: "working" | "awaiting" } | null;
}

interface WorkflowStepProps {
  stage: WorkflowStage;
  isLast?: boolean;
}

const statusStyles: Record<
  WorkflowStepStatus,
  { dot: string; label: string; connector: string; srText: string }
> = {
  completed: {
    dot: "bg-emerald-500 border-emerald-500 text-emerald-50",
    label: "text-foreground font-medium",
    connector: "bg-emerald-200 dark:bg-emerald-800",
    srText: "Completed:",
  },
  active: {
    dot: "bg-blue-500 border-blue-500 ring-2 ring-blue-500/20",
    label: "text-blue-600 dark:text-blue-400 font-medium",
    connector: "bg-border",
    srText: "In progress:",
  },
  pending: {
    dot: "bg-background border-border",
    label: "text-muted-foreground",
    connector: "bg-border",
    srText: "Pending:",
  },
  failed: {
    dot: "bg-red-500 border-red-500 text-red-50",
    label: "text-red-600 dark:text-red-400 font-medium",
    connector: "bg-border",
    srText: "Failed:",
  },
};

export function WorkflowStep({ stage, isLast = false }: WorkflowStepProps) {
  const styles = statusStyles[stage.status];

  return (
    <li className="flex gap-3" aria-current={stage.status === "active" ? "step" : undefined}>
      {/* Left: dot + connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
            styles.dot
          )}
        >
          {stage.status === "completed" && (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
          )}
          {stage.status === "failed" && (
            <HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
          )}
        </div>
        {!isLast && (
          <div className={cn("mt-1 w-px flex-1 min-h-4", styles.connector)} />
        )}
      </div>

      {/* Right: content */}
      <div className={cn("pb-4 min-w-0", isLast && "pb-0")}>
        <p className={cn("text-sm leading-none", styles.label)}>
          <span className="sr-only">{styles.srText} </span>
          {stage.label}
        </p>
        {stage.activity && (
          <ProcessingIndicator
            label={stage.activity.label}
            variant={stage.activity.variant}
            className="mt-1"
          />
        )}
        {stage.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{stage.note}</p>
        )}
        {stage.timestamp && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70 tabular-nums">
            {formatDateTime(stage.timestamp)}
          </p>
        )}
      </div>
    </li>
  );
}
