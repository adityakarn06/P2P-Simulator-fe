import { WorkflowStep } from "@/components/workflow/workflow-step";
import type { WorkflowStage } from "@/components/workflow/workflow-step";
import { cn } from "@/lib/utils";

interface WorkflowTimelineProps {
  /**
   * Stages driven entirely by real backend state.
   * The caller is responsible for mapping backend status → WorkflowStage[].
   * Never hardcode stages as completed here.
   */
  stages: WorkflowStage[];
  className?: string;
  /** Called when a completed or active stage is clicked. */
  onStageSelect?: (stage: WorkflowStage) => void;
}

export function WorkflowTimeline({ stages, className, onStageSelect }: WorkflowTimelineProps) {
  if (stages.length === 0) return null;

  return (
    <ol className={cn("space-y-0", className)} aria-label="Workflow progress">
      {stages.map((stage, idx) => (
        <WorkflowStep
          key={stage.id}
          stage={stage}
          isLast={idx === stages.length - 1}
          onSelect={onStageSelect}
        />
      ))}
    </ol>
  );
}

// Re-export so consumers can import from one place
export type { WorkflowStage } from "@/components/workflow/workflow-step";
