"use client";

import Link from "next/link";
import { useProduct } from "@/hooks/use-catalog";
import { PageHeader } from "@/components/common/page-header";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState } from "@/components/common/error-state";
import { ProductOffersTable } from "@/components/suppliers/product-offers-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@/lib/icons";

interface ProductDetailProps {
  id: string;
}

export function ProductDetail({ id }: ProductDetailProps) {
  const { data, isLoading, isError, error, refetch } = useProduct(id);

  if (isLoading) {
    return <LoadingState message="Loading product…" className="flex-1" />;
  }

  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => refetch()} className="flex-1" />;
  }

  const { product, offers } = data;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <Link
        href="/products"
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        Back to products
      </Link>

      <PageHeader title={product.name} description={product.description ?? undefined} />

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">SKU</p>
          <p className="text-sm font-mono">{product.sku}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Category</p>
          <p className="text-sm">{product.category ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Unit</p>
          <p className="text-sm">{product.unit}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Suppliers</p>
          <p className="text-sm tabular-nums">{offers.length}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Supplier offers</p>
        <p className="text-xs text-muted-foreground">
          Cheapest first, then fastest — the same ordering supplier discovery starts from.
        </p>
        <ProductOffersTable offers={offers} />
      </div>
    </div>
  );
}
