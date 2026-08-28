"use client";

import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { Money } from "@/components/common/money";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";
import {
  formatRate,
  reliabilityTrend,
  NO_VALUE,
} from "@/lib/state/analytics-state";
import { formatRelativeTime } from "@/lib/formatters";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon } from "@/lib/icons";
import type { SupplierScorecardRow } from "@/types/analytics";

/**
 * A number that may genuinely not exist yet. A supplier that has never
 * delivered reports `null` for every rate, not `0` — rendering those as "0%"
 * would accuse a brand-new supplier of never delivering on time.
 */
function Rate({ value }: { value: number | null }) {
  return (
    <span className={cn("tabular-nums", value == null && "text-muted-foreground")}>
      {formatRate(value)}
    </span>
  );
}

function ReliabilityCell({ row }: { row: SupplierScorecardRow }) {
  const trend = reliabilityTrend(row.reliabilityDelta);

  return (
    <div className="flex items-center gap-1.5">
      <Rate value={row.reliabilityScore} />
      {trend === "up" && (
        <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5 text-emerald-600" />
      )}
      {trend === "down" && (
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 text-red-600" />
      )}
      {row.reliabilityDelta != null && trend !== "flat" && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {row.reliabilityDelta > 0 ? "+" : ""}
          {row.reliabilityDelta.toFixed(2)}
        </span>
      )}
    </div>
  );
}

const columns: AppColumnDef<SupplierScorecardRow>[] = [
  {
    accessorKey: "supplierName",
    header: "Supplier",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.supplierName}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.totalDeliveries === 0
            ? "No deliveries yet"
            : `${row.original.totalDeliveries} deliveries`}
          {row.original.lastDeliveryAt &&
            ` · last ${formatRelativeTime(row.original.lastDeliveryAt)}`}
        </p>
      </div>
    ),
  },
  {
    id: "reliability",
    header: "Reliability",
    cell: ({ row }) => <ReliabilityCell row={row.original} />,
  },
  {
    id: "otif",
    header: "OTIF",
    cell: ({ row }) => <Rate value={row.original.otifRate} />,
  },
  {
    id: "onTime",
    header: "On time",
    cell: ({ row }) => <Rate value={row.original.onTimeRate} />,
  },
  {
    id: "damage",
    header: "Damage",
    cell: ({ row }) => <Rate value={row.original.damageRate} />,
  },
  {
    id: "leadTime",
    header: "Lead time",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.avgLeadTimeDays == null
          ? NO_VALUE
          : `${row.original.avgLeadTimeDays.toFixed(1)}d`}
      </span>
    ),
  },
  {
    id: "spend",
    header: "Committed spend",
    cell: ({ row }) => (
      <div className="text-right">
        {/* Computed from `paise`; the API's `display` string is never parsed back. */}
        <Money paise={row.original.spend.paise} />
        <p className="text-xs text-muted-foreground">
          {row.original.purchaseOrders} orders
        </p>
      </div>
    ),
  },
];

/**
 * The vendor scorecard — the closest thing to a supplier list, since
 * GET /suppliers does not exist.
 *
 * `reliabilityScore` is not decoration: it carries the RELIABILITY weight in
 * the supplier score, so this table shows exactly why the next requisition will
 * pick who it picks.
 */
export function SupplierScorecardTable({
  suppliers,
  isLoading,
}: {
  suppliers: SupplierScorecardRow[];
  isLoading?: boolean;
}) {
  return (
    <DataTable
      columns={columns}
      data={suppliers}
      isLoading={isLoading}
      emptyState={<EmptyState title="No suppliers on record yet." className="py-10" />}
    />
  );
}
