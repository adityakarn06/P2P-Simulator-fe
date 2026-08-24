import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";

export type WorkflowStepStatus = "completed" | "active" | "pending" | "failed";

export interface WorkflowStage {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  /** ISO 8601 timestamp */
  timestamp?: string | null;
  /** Short context note rendered below the label */
  note?: string | null;
}

interface WorkflowStepProps {
  stage: WorkflowStage;
  isLast?: boolean;
}

const statusStyles: Record<WorkflowStepStatus, { dot: string; label: string; connector: string }> = {
  completed: {
    dot: "bg-emerald-500 border-emerald-500",
    label: "text-foreground font-medium",
    connector: "bg-emerald-200 dark:bg-emerald-800",
  },
  active: {
    dot: "bg-blue-500 border-blue-500 ring-2 ring-blue-500/20",
    label: "text-blue-600 dark:text-blue-400 font-medium",
    connector: "bg-border",
  },
  pending: {
    dot: "bg-background border-border",
    label: "text-muted-foreground",
    connector: "bg-border",
  },
  failed: {
    dot: "bg-red-500 border-red-500",
    label: "text-red-600 dark:text-red-400 font-medium",
    connector: "bg-border",
  },
};

export function WorkflowStep({ stage, isLast = false }: WorkflowStepProps) {
  const styles = statusStyles[stage.status];

  return (
    <div className="flex gap-3">
      {/* Left: dot + connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "mt-0.5 size-2.5 shrink-0 rounded-full border",
            styles.dot
          )}
        />
        {!isLast && (
          <div className={cn("mt-1 w-px flex-1 min-h-4", styles.connector)} />
        )}
      </div>

      {/* Right: content */}
      <div className={cn("pb-4 min-w-0", isLast && "pb-0")}>
        <p className={cn("text-sm leading-none", styles.label)}>{stage.label}</p>
        {stage.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{stage.note}</p>
        )}
        {stage.timestamp && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70 tabular-nums">
            {formatDateTime(stage.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
