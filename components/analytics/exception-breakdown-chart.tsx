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
import { toExceptionBreakdownData } from "@/lib/state/analytics-state";
import type { AnalyticsExceptions } from "@/types/analytics";

const config: ChartConfig = {
  open: { label: "Open", color: "var(--chart-1)" },
  resolved: { label: "Resolved", color: "var(--chart-2)" },
  rejected: { label: "Rejected", color: "var(--chart-5)" },
};

/**
 * Exceptions by type, stacked by outcome.
 *
 * `open` folds in both OPEN and UNDER_REVIEW — the API makes that call, and the
 * split is workflow detail a summary does not need. Rows arrive sorted by total
 * descending and that order is preserved.
 */
export function ExceptionBreakdownChart({
  exceptions,
}: {
  exceptions: AnalyticsExceptions;
}) {
  const rows = toExceptionBreakdownData(exceptions);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={150}
          fontSize={11}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="open" stackId="a" fill="var(--color-open)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="resolved" stackId="a" fill="var(--color-resolved)" />
        <Bar dataKey="rejected" stackId="a" fill="var(--color-rejected)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
