"use client";

import { Cell, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkflowProgress } from "@/lib/state/requisition-state";
import type { WorkflowStage } from "@/components/workflow/workflow-step";

interface WorkflowProgressGaugeProps {
  stages: WorkflowStage[];
  className?: string;
}

/**
 * Semicircular gauge summarizing how far a requisition has moved through
 * the P2P workflow: one arc segment per stage, filled for completed stages
 * and dimmed for the rest. Driven entirely by the same `stages` array the
 * timeline renders (see getWorkflowProgress) — never a hardcoded count.
 */
export function WorkflowProgressGauge({ stages, className }: WorkflowProgressGaugeProps) {
  const { completed, total, percent } = getWorkflowProgress(stages);
  if (total === 0) return null;

  const data = stages.map((stage, idx) => ({
    id: stage.id,
    value: 1,
    completed: stage.status === "completed",
    idx,
  }));

  const remaining = total - completed;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Workflow Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto flex w-full max-w-56 flex-col items-center">
          <PieChart width={224} height={124}>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="100%"
              innerRadius={64}
              outerRadius={96}
              paddingAngle={4}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={entry.completed ? "var(--foreground)" : "var(--muted)"}
                />
              ))}
            </Pie>
          </PieChart>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{percent}%</p>
            <p className="text-[11px] text-muted-foreground">Complete</p>
          </div>

          <div className="mt-1 flex w-full items-start justify-between px-1">
            <div className="flex flex-col items-start">
              <span className="text-xs text-muted-foreground">Completed</span>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {completed}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Remaining</span>
              <span className="text-sm font-medium tabular-nums text-foreground">
                {remaining}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
