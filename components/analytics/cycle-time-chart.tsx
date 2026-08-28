"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatDuration,
  toCycleTimeChartData,
} from "@/lib/state/analytics-state";
import type { AnalyticsCycleTimes } from "@/types/analytics";

/**
 * Median leads, mean follows, p90 last. Procurement durations are skewed — one
 * requisition left over a weekend drags a mean into something no buyer
 * recognises as their own process — so the median is the honest headline and
 * the mean is context.
 */
const config: ChartConfig = {
  medianHours: { label: "Median", color: "var(--chart-1)" },
  meanHours: { label: "Mean", color: "var(--chart-2)" },
  p90Hours: { label: "p90", color: "var(--chart-5)" },
};

export function CycleTimeChart({ cycleTimes }: { cycleTimes: AnalyticsCycleTimes }) {
  const rows = toCycleTimeChartData(cycleTimes);

  return (
    <div className="space-y-4">
      <ChartContainer config={config} className="h-64 w-full">
        <BarChart data={rows} margin={{ left: 4, right: 4, top: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            fontSize={11}
            tickFormatter={(h: number) => formatDuration(h)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatDuration(Number(value))}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="medianHours" fill="var(--color-medianHours)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="meanHours" fill="var(--color-meanHours)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="p90Hours" fill="var(--color-p90Hours)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.stage}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">
              {formatDuration(row.medianHours)}{" "}
              <span className="text-muted-foreground">
                median · {row.count} completed
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
