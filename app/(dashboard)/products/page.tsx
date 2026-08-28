"use client";

import Link from "next/link";
import { useProductList } from "@/hooks/use-product-list";
import { PageHeader } from "@/components/common/page-header";
import { DataTable, type AppColumnDef } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_FILTER_ALL } from "@/store/catalog-store";
import type { Product } from "@/types/catalog";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, PackageIcon } from "@/lib/icons";

const columns: AppColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <Link
        href={`/products/${row.original.id}`}
        className="block max-w-[240px] truncate text-sm font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.sku}</span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.category ?? "—"}</span>
    ),
  },
  {
    accessorKey: "unit",
    header: "Unit",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.unit}</span>,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Link
        href={`/products/${row.original.id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
        aria-label="Open product"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
      </Link>
    ),
  },
];

export default function ProductsPage() {
  const {
    query,
    setQuery,
    category,
    setCategory,
    categories,
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProductList();

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Products"
        description="The catalog requisitions are matched against. Open a product to compare every supplier's price against its delivery record."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="max-w-xs"
          aria-label="Search products by name or SKU"
        />
        {/* Base UI hands back `null` when a selection is cleared; the store
            holds the "all" sentinel instead, so a cleared select falls back to
            it rather than sending an empty category to the API. */}
        <Select
          value={category}
          onValueChange={(v) => setCategory(v ?? CATEGORY_FILTER_ALL)}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_FILTER_ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        skeletonRows={8}
        emptyState={
          <EmptyState
            icon={PackageIcon}
            title="No products found"
            description={
              query
                ? `Nothing in the catalog matches "${query}".`
                : "The catalog is seeded on the backend; no products are registered for this organization."
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
