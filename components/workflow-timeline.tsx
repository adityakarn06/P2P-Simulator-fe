import { WorkflowStep } from "@/components/workflow-step";
import type { WorkflowStage } from "@/components/workflow-step";
import { cn } from "@/lib/utils";

interface WorkflowTimelineProps {
  /**
   * Stages driven entirely by real backend state.
   * The caller is responsible for mapping backend status → WorkflowStage[].
   * Never hardcode stages as completed here.
   */
  stages: WorkflowStage[];
  className?: string;
}

export function WorkflowTimeline({ stages, className }: WorkflowTimelineProps) {
  if (stages.length === 0) return null;

  return (
    <div className={cn("space-y-0", className)}>
      {stages.map((stage, idx) => (
        <WorkflowStep
          key={stage.id}
          stage={stage}
          isLast={idx === stages.length - 1}
        />
      ))}
    </div>
  );
}

// Re-export so consumers can import from one place
export type { WorkflowStage } from "@/components/workflow-step";
