"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { toTopSupplierSpendData } from "@/lib/state/analytics-state";
import { formatCurrencyCompact } from "@/lib/formatters";
import type { TopSupplierSpend } from "@/types/analytics";

const config: ChartConfig = {
  paise: { label: "Committed", color: "var(--chart-2)" },
};

/**
 * Top suppliers by committed spend.
 *
 * Plotted from `spend.paise` — the integer minor units — and never from the
 * API's pre-formatted `display` string, which is for rendering only.
 */
export function SupplierSpendChart({
  topSuppliers,
}: {
  topSuppliers: TopSupplierSpend[];
}) {
  const rows = toTopSupplierSpendData(topSuppliers);

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 12 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          tickFormatter={(paise: number) => formatCurrencyCompact(paise)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={140}
          fontSize={11}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatCurrencyCompact(Number(value))}
            />
          }
        />
        <Bar dataKey="paise" fill="var(--color-paise)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
