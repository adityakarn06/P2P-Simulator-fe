"use client";

import Link from "next/link";
import { useSupplierList } from "@/hooks/use-supplier-list";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  formatRate,
  formatReliabilityDelta,
  getInFullRate,
  getOnTimeRate,
  getReliabilityDelta,
} from "@/lib/state/catalog-state";
import type { Supplier } from "@/types/catalog";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, PackageIcon } from "@/lib/icons";

const columns: AppColumnDef<Supplier>[] = [
  {
    accessorKey: "name",
    header: "Supplier",
    cell: ({ row }) => (
      <Link
        href={`/suppliers/${row.original.id}`}
        className="block max-w-[220px] truncate text-sm font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-[11px]">
        {row.original.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.original.rating.toFixed(1)}</span>
    ),
  },
  {
    accessorKey: "reliabilityScore",
    header: "Reliability",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {formatRate(row.original.reliabilityScore)}
        <span className="ml-1.5 text-xs text-muted-foreground">
          {formatReliabilityDelta(getReliabilityDelta(row.original))}
        </span>
      </span>
    ),
  },
  {
    id: "onTime",
    header: "On time",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{formatRate(getOnTimeRate(row.original))}</span>
    ),
  },
  {
    id: "inFull",
    header: "In full",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{formatRate(getInFullRate(row.original))}</span>
    ),
  },
  {
    accessorKey: "avgLeadTimeDays",
    header: "Lead time",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {row.original.avgLeadTimeDays != null ? `${row.original.avgLeadTimeDays} d` : "—"}
      </span>
    ),
  },
  {
    id: "offers",
    header: "Offers",
    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-muted-foreground">
        {row.original._count?.supplierProducts ?? "—"}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/suppliers/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label="Open supplier"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

export default function SuppliersPage() {
  const { query, setQuery, activeOnly, setActiveOnly, data, isLoading, isError, error, refetch } =
    useSupplierList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Suppliers"
        description="The enterprise catalog supplier discovery ranks against. Read-only — a price or stock level that changed at runtime would silently alter what the next requisition buys."
      />

      <div className="flex flex-wrap items-center gap-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search suppliers by name…"
          className="max-w-xs"
          aria-label="Search suppliers by name"
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="active-only"
            checked={activeOnly}
            onCheckedChange={(checked) => setActiveOnly(checked === true)}
          />
          <Label htmlFor="active-only" className="text-sm font-normal">
            Active only
          </Label>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={PackageIcon}
            title="No suppliers found"
            description={
              query
                ? `No supplier name matches "${query}".`
                : "The catalog is seeded on the backend; no suppliers are registered for this organization."
            }
            className="py-12"
          />
        }
      />

      {data?.nextCursor && (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Showing first 100 results.
        </p>
      )}
    </div>
  );
}
