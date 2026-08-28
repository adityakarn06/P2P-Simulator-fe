"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  toFunnelChartData,
  toFunnelStageTotals,
  FUNNEL_STAGE_LABELS,
  type FunnelStage,
} from "@/lib/state/analytics-state";
import type { AnalyticsFunnel } from "@/types/analytics";

const stageConfig: ChartConfig = {
  total: { label: "Records", color: "var(--chart-1)" },
};

const statusConfig: ChartConfig = {
  count: { label: "Records", color: "var(--chart-2)" },
};

interface FunnelChartProps {
  funnel: AnalyticsFunnel;
  /** Which stage's status breakdown to show below the stage totals. */
  stage: FunnelStage;
  onStageChange: (stage: FunnelStage) => void;
}

/**
 * The pipeline's shape: total records at each stage, and the status breakdown
 * within the selected one.
 *
 * Zero-count statuses are deliberately kept — the API returns every status in
 * the enum with a `0` precisely so the axis stays stable on an empty
 * organization instead of collapsing to nothing.
 */
export function FunnelChart({ funnel, stage, onStageChange }: FunnelChartProps) {
  const stageTotals = toFunnelStageTotals(funnel);
  const statusRows = toFunnelChartData(funnel[stage] ?? {});

  return (
    <div className="space-y-5">
      <ChartContainer config={stageConfig} className="h-44 w-full">
        <BarChart data={stageTotals} margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <div>
        <div
          role="tablist"
          aria-label="Funnel stage"
          className="mb-3 flex flex-wrap gap-1.5"
        >
          {(Object.keys(FUNNEL_STAGE_LABELS) as FunnelStage[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === stage}
              onClick={() => onStageChange(s)}
              className={
                s === stage
                  ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
              }
            >
              {FUNNEL_STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        <ChartContainer config={statusConfig} className="h-52 w-full">
          <BarChart
            data={statusRows}
            layout="vertical"
            margin={{ left: 4, right: 12 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={140}
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}
